import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toLocalDateKey } from '../common/date.helper';

export type FollowUpKind = 'DOCTOR_FOLLOW_UP' | 'PACKAGE_SITTING';
export type CallOutcome = 'NO_ANSWER' | 'CALL_BACK' | 'DECLINED' | 'BOOKED';

export interface FollowUpReason {
  kind: FollowUpKind;
  refId: string;
  dueDate: string | null;
  label: string;
  overdueDays: number;
  lastCall: { outcome: CallOutcome; callBackOn: string | null; attempts: number } | null;
}

export interface FollowUpItem {
  patient: { id: string; name: string; phone: string; uhid: string };
  reasons: FollowUpReason[];
  dueDate: string | null;
  overdueDays: number;
  doctorName?: string;
}

export interface FollowUpBuckets {
  overdue: FollowUpItem[];
  today: FollowUpItem[];
  next7Days: FollowUpItem[];
  unknownDate: FollowUpItem[];
}

interface GetFollowUpsOptions {
  rmId?: string;
  from?: string;
  to?: string;
}

const addDays = (dateStr: string, n: number): string => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return toLocalDateKey(d);
};

@Injectable()
export class FollowUpsService {
  constructor(private prisma: PrismaService) {}

  async getFollowUps(clinicId: string, opts: GetFollowUpsOptions = {}): Promise<FollowUpBuckets> {
    const today = toLocalDateKey(new Date());
    const next7 = addDays(today, 7);

    // --- 1. DOCTOR_FOLLOW_UP items from visits with nextAppointmentDate ---
    const visitWhere: any = {
      clinicId,
      nextAppointmentDate: { not: null, lte: opts.to ?? today },
    };
    if (opts.rmId) visitWhere.rmId = opts.rmId;
    if (opts.from) visitWhere.nextAppointmentDate = { ...visitWhere.nextAppointmentDate, gte: opts.from };

    const followUpVisits = await this.prisma.visit.findMany({
      where: visitWhere,
      select: {
        id: true,
        nextAppointmentDate: true,
        treatmentName: true,
        diagnosis: true,
        patient: { select: { id: true, name: true, phone: true, uhid: true } },
        doctor: { select: { name: true } },
      },
      orderBy: { nextAppointmentDate: 'asc' },
    });

    // Bulk-check who has already returned: one grouped count instead of N queries
    const allPatientIds = [...new Set(followUpVisits.map(v => v.patient.id))];

    // For each (patientId, dueDate) pair, check if there's a later visit or queue entry
    // We load all relevant visits in one shot and check in-memory
    const laterVisits = allPatientIds.length ? await this.prisma.visit.findMany({
      where: { clinicId, patientId: { in: allPatientIds } },
      select: { patientId: true, date: true },
    }) : [];

    const laterQueue = allPatientIds.length ? await this.prisma.patientQueue.findMany({
      where: { clinicId, patientId: { in: allPatientIds } },
      select: { patientId: true, queueDate: true },
    }) : [];

    // Build map: patientId -> max(visit.date, queue.queueDate)
    const latestReturn = new Map<string, string>();
    for (const v of laterVisits) {
      const cur = latestReturn.get(v.patientId) ?? '';
      if (v.date > cur) latestReturn.set(v.patientId, v.date);
    }
    for (const q of laterQueue) {
      const cur = latestReturn.get(q.patientId) ?? '';
      if (q.queueDate > cur) latestReturn.set(q.patientId, q.queueDate);
    }

    // Scheduled appointments: load all future ones for these patients
    const scheduledAppts = allPatientIds.length ? await this.prisma.appointment.findMany({
      where: {
        clinicId,
        patientId: { in: allPatientIds },
        status: 'Scheduled',
        startTime: { gte: new Date() },
      },
      select: { patientId: true },
    }) : [];
    const hasScheduled = new Set(scheduledAppts.map(a => a.patientId));

    // Latest FollowUpCall per (refId, dueDate)
    const visitRefIds = followUpVisits.map(v => v.id);
    const visitCalls = visitRefIds.length ? await this.prisma.followUpCall.findMany({
      where: { clinicId, kind: 'DOCTOR_FOLLOW_UP', refId: { in: visitRefIds } },
      orderBy: { createdAt: 'desc' },
    }) : [];

    // Group calls by refId+dueDate
    const callMap = new Map<string, typeof visitCalls>();
    for (const c of visitCalls) {
      const key = `${c.refId}__${c.dueDate}`;
      if (!callMap.has(key)) callMap.set(key, []);
      callMap.get(key)!.push(c);
    }

    const doctorItems: FollowUpItem[] = [];
    for (const v of followUpVisits) {
      const dueDate = v.nextAppointmentDate!;
      const patientLastReturn = latestReturn.get(v.patient.id) ?? '';

      // Skip if patient returned on or after due date
      if (patientLastReturn >= dueDate) continue;
      // Skip if patient has a future scheduled appointment
      if (hasScheduled.has(v.patient.id)) continue;

      const key = `${v.id}__${dueDate}`;
      const calls = callMap.get(key) ?? [];
      const latestCall = calls[0] ?? null;

      // Skip DECLINED
      if (latestCall?.outcome === 'DECLINED') continue;
      // Skip CALL_BACK if still in future
      if (latestCall?.outcome === 'CALL_BACK' && latestCall.callBackOn && latestCall.callBackOn > today) continue;

      const noAnswerCount = calls.filter(c => c.outcome === 'NO_ANSWER').length;
      const overdueDays = dueDate < today
        ? Math.round((Date.parse(today) - Date.parse(dueDate)) / 86400000)
        : 0;

      const reason = v.treatmentName && v.treatmentName !== 'Not Specified'
        ? v.treatmentName
        : (v.diagnosis ? v.diagnosis.slice(0, 50) : 'Follow-up');

      doctorItems.push({
        patient: v.patient,
        dueDate,
        overdueDays,
        reasons: [{
          kind: 'DOCTOR_FOLLOW_UP',
          refId: v.id,
          dueDate,
          label: reason + (v.doctor?.name ? ` — Dr. ${v.doctor.name}` : ''),
          overdueDays,
          lastCall: latestCall ? {
            outcome: latestCall.outcome as CallOutcome,
            callBackOn: latestCall.callBackOn ?? null,
            attempts: noAnswerCount || 1,
          } : null,
        }],
        doctorName: v.doctor?.name,
      });
    }

    // --- 2. PACKAGE_SITTING items ---
    const pkgWhere: any = {
      clinicId,
      sittingsRemaining: { gt: 0 },
    };
    if (opts.rmId) {
      // Scope to RM's clients: patients who have at least one visit with rmId
      const rmPatients = await this.prisma.visit.findMany({
        where: { clinicId, rmId: opts.rmId },
        select: { patientId: true },
        distinct: ['patientId'],
      });
      const rmPatientIds = rmPatients.map(r => r.patientId);
      if (rmPatientIds.length === 0) {
        // RM has no clients, return empty package list
        pkgWhere.patientId = { in: [] };
      } else {
        pkgWhere.patientId = { in: rmPatientIds };
      }
    }

    const purchases = await this.prisma.packagePurchase.findMany({
      where: pkgWhere,
      include: {
        patient: { select: { id: true, name: true, phone: true, uhid: true } },
        packageType: { select: { sittingGapDays: true, treatmentId: true } },
        visits: {
          select: { date: true },
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    const purchaseRefIds = purchases.map(p => p.id);
    const pkgCalls = purchaseRefIds.length ? await this.prisma.followUpCall.findMany({
      where: { clinicId, kind: 'PACKAGE_SITTING', refId: { in: purchaseRefIds } },
      orderBy: { createdAt: 'desc' },
    }) : [];
    const pkgCallMap = new Map<string, typeof pkgCalls>();
    for (const c of pkgCalls) {
      const key = `${c.refId}__${c.dueDate}`;
      if (!pkgCallMap.has(key)) pkgCallMap.set(key, []);
      pkgCallMap.get(key)!.push(c);
    }

    const pkgItems: FollowUpItem[] = [];
    for (const p of purchases) {
      const gap = p.packageType?.sittingGapDays;
      const lastVisitDate = p.visits[0]?.date ?? null;

      // Due date only computable when gap exists AND there's been a visit
      const dueDate = (gap && lastVisitDate) ? addDays(lastVisitDate, gap) : null;

      // Skip if patient has returned (visit date >= due date)
      if (dueDate) {
        const patientLastReturn = latestReturn.get(p.patientId) ?? '';
        if (patientLastReturn >= dueDate) continue;
      }
      // Skip if patient has a future scheduled appointment
      if (hasScheduled.has(p.patientId)) continue;

      // Check calls
      const key = dueDate ? `${p.id}__${dueDate}` : `${p.id}__unknown`;
      const calls = pkgCallMap.get(key) ?? [];
      const latestCall = calls[0] ?? null;
      if (latestCall?.outcome === 'DECLINED') continue;
      if (latestCall?.outcome === 'CALL_BACK' && latestCall.callBackOn && latestCall.callBackOn > today) continue;

      const noAnswerCount = calls.filter(c => c.outcome === 'NO_ANSWER').length;
      const overdueDays = dueDate && dueDate < today
        ? Math.round((Date.parse(today) - Date.parse(dueDate)) / 86400000)
        : 0;

      const parts = p.purchaseDate.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const boughtStr = parts.length === 3 ? `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1]}` : p.purchaseDate;
      const sittingLabel = `${p.packageName} (bought ${boughtStr}) — sitting ${p.sittingsUsed + 1} of ${p.totalSittings}`;

      pkgItems.push({
        patient: p.patient,
        dueDate,
        overdueDays,
        reasons: [{
          kind: 'PACKAGE_SITTING',
          refId: p.id,
          dueDate,
          label: dueDate ? sittingLabel : `${sittingLabel} (Date unknown — call to schedule)`,
          overdueDays,
          lastCall: latestCall ? {
            outcome: latestCall.outcome as CallOutcome,
            callBackOn: latestCall.callBackOn ?? null,
            attempts: noAnswerCount || 1,
          } : null,
        }]
      });
    }

    // --- 3. Merge doctor+package items by patient, group reasons ---
    const allItems = [...doctorItems, ...pkgItems];
    const byPatient = new Map<string, FollowUpItem>();

    for (const item of allItems) {
      const existing = byPatient.get(item.patient.id);
      if (existing) {
        // Merge reasons; keep earliest due date; pick highest overdueDays
        for (const r of item.reasons) existing.reasons.push(r);
        if (item.dueDate && (!existing.dueDate || item.dueDate < existing.dueDate)) {
          existing.dueDate = item.dueDate;
          existing.overdueDays = Math.max(existing.overdueDays, item.overdueDays);
        }
      } else {
        byPatient.set(item.patient.id, { ...item });
      }
    }

    const merged = [...byPatient.values()];

    // --- 4. Bucket ---
    const buckets: FollowUpBuckets = { overdue: [], today: [], next7Days: [], unknownDate: [] };
    for (const item of merged) {
      if (!item.dueDate) {
        buckets.unknownDate.push(item);
      } else if (item.dueDate < today) {
        buckets.overdue.push(item);
      } else if (item.dueDate === today) {
        buckets.today.push(item);
      } else if (item.dueDate <= next7) {
        buckets.next7Days.push(item);
      }
      // future beyond 7 days: omit from default view (accessible via from/to params)
    }

    // Sort each bucket by due date asc, overdueDays desc
    const sortItems = (a: FollowUpItem, b: FollowUpItem) =>
      (a.dueDate ?? '9999') < (b.dueDate ?? '9999') ? -1 : 1;
    buckets.overdue.sort(sortItems);
    buckets.today.sort(sortItems);
    buckets.next7Days.sort(sortItems);

    return buckets;
  }

  async getSummary(clinicId: string, opts: GetFollowUpsOptions = {}) {
    const buckets = await this.getFollowUps(clinicId, opts);
    return {
      overdue: buckets.overdue.length,
      today: buckets.today.length,
      total: buckets.overdue.length + buckets.today.length,
    };
  }

  async logCall(
    clinicId: string,
    calledById: string,
    dto: {
      patientId: string;
      kind: FollowUpKind;
      refId: string;
      dueDate: string;
      outcome: CallOutcome;
      note?: string;
      callBackOn?: string;
    },
  ) {
    // Validate outcome-specific requirements
    if (dto.outcome === 'CALL_BACK') {
      if (!dto.callBackOn) {
        throw new BadRequestException('callBackOn is required for CALL_BACK outcome');
      }
      const today = new Date().toISOString().split('T')[0];
      if (dto.callBackOn < today) {
        throw new BadRequestException('callBackOn cannot be in the past');
      }
    }

    // Validate refId belongs to this clinic and matches kind
    if (dto.kind === 'DOCTOR_FOLLOW_UP') {
      const visit = await this.prisma.visit.findFirst({
        where: { id: dto.refId, clinicId, patientId: dto.patientId },
      });
      if (!visit) throw new NotFoundException('Visit not found in this clinic for this patient');
    } else if (dto.kind === 'PACKAGE_SITTING') {
      const purchase = await this.prisma.packagePurchase.findFirst({
        where: { id: dto.refId, clinicId, patientId: dto.patientId },
      });
      if (!purchase) throw new NotFoundException('Package purchase not found in this clinic for this patient');
    } else {
      throw new BadRequestException(`Unknown kind: ${dto.kind}`);
    }

    return this.prisma.followUpCall.create({
      data: {
        clinicId,
        patientId: dto.patientId,
        kind: dto.kind,
        refId: dto.refId,
        dueDate: dto.dueDate,
        outcome: dto.outcome,
        note: dto.note,
        callBackOn: dto.callBackOn,
        calledById,
      },
    });
  }
}
