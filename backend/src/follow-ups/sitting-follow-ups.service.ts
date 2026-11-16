import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toLocalDateKey } from '../common/date.helper';
import { addDays, computePurchasePlan, diffDays } from '../packages/package-plan';

/** Where the package's next sitting stands. */
export type SittingStatus = 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'LATER' | 'NO_DATE' | 'EXPIRED' | 'LAPSED';
/** What reception has done about it. */
export type SittingFollowUp = 'IN_CLINIC' | 'BOOKED' | 'DECLINED' | 'CALL_BACK' | 'TO_CALL';

/** The fields the board sorts and counts by; the rest is passed through to the screen. */
export interface BoardRow {
  status: SittingStatus;
  followUp: SittingFollowUp;
  dueDate: string | null;
  overdueDays: number;
  expiringSoon: boolean;
  [field: string]: unknown;
}

const UPCOMING_DAYS = 7;
const EXPIRING_DAYS = 7;
/** Lapsed packages stay on the board this long, to offer the package again. */
const LAPSED_WINDOW_DAYS = 60;

/**
 * The package-sittings board for reception: every package with sittings left,
 * when the next one is due, whether the patient missed it, and the calls made.
 * Calls are the same FollowUpCall records the general follow-ups list uses, keyed
 * by package + due date, so both screens agree.
 */
@Injectable()
export class SittingFollowUpsService {
  constructor(private readonly prisma: PrismaService) {}

  async board(clinicId: string) {
    const today = toLocalDateKey(new Date());
    const upcomingUntil = addDays(today, UPCOMING_DAYS);

    const purchases = await this.prisma.packagePurchase.findMany({
      where: {
        clinicId,
        sittingsRemaining: { gt: 0 },
        OR: [{ lapsedAt: null }, { lapsedAt: { gte: addDays(today, -LAPSED_WINDOW_DAYS) } }],
      },
      include: {
        patient: { select: { id: true, name: true, phone: true, uhid: true } },
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { sittings: { select: { date: true }, orderBy: { date: 'asc' } } },
        },
      },
      orderBy: { purchaseDate: 'desc' },
    });

    const holidays = new Set(
      (await this.prisma.clinicHoliday.findMany({ where: { clinicId }, select: { date: true } })).map((h) => h.date),
    );
    // A lapsed package the patient has since bought again needs no call.
    const rebought = new Set(purchases.filter((p) => !p.lapsedAt).map((p) => `${p.patientId}__${p.packageTypeId}`));

    const patientIds = [...new Set(purchases.map((p) => p.patientId))];
    const purchaseIds = purchases.map((p) => p.id);

    const [appointments, todaysQueue, calls] = patientIds.length
      ? await Promise.all([
          this.prisma.appointment.findMany({
            where: { clinicId, patientId: { in: patientIds }, status: 'Scheduled', startTime: { gte: new Date(`${today}T00:00:00`) } },
            select: { patientId: true, startTime: true, reasonForVisit: true, doctor: { select: { name: true } } },
            orderBy: { startTime: 'asc' },
          }),
          this.prisma.patientQueue.findMany({
            where: { clinicId, queueDate: today, patientId: { in: patientIds }, status: { not: 'CANCELLED' } },
            select: { patientId: true, sittingPurchaseId: true, status: true },
          }),
          this.prisma.followUpCall.findMany({
            where: { clinicId, kind: 'PACKAGE_SITTING', refId: { in: purchaseIds } },
            select: {
              id: true, refId: true, dueDate: true, outcome: true, note: true, callBackOn: true, bookedTime: true, createdAt: true,
              calledBy: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
        ])
      : [[], [], []];

    const nextAppointment = new Map<string, (typeof appointments)[number]>();
    for (const a of appointments) if (!nextAppointment.has(a.patientId)) nextAppointment.set(a.patientId, a);
    const callsByPurchase = new Map<string, typeof calls>();
    for (const c of calls) {
      if (!callsByPurchase.has(c.refId)) callsByPurchase.set(c.refId, []);
      callsByPurchase.get(c.refId)!.push(c);
    }

    const rows: BoardRow[] = [];
    for (const p of purchases) {
      const plan = computePurchasePlan(
        { ...p, items: p.items.map((i) => ({ ...i, sittingDates: i.sittings.map((s) => s.date) })) },
        holidays,
        today,
      );
      if (plan.state === 'COMPLETED') continue;
      if (plan.state === 'LAPSED' && rebought.has(`${p.patientId}__${p.packageTypeId}`)) continue;

      // Same due-date convention as the follow-ups list, so logged calls match up.
      const dueDate =
        plan.state === 'LAPSED' ? p.lapsedAt
        : plan.state === 'EXPIRED' ? plan.expiryDate
        : plan.nextSittingDate;

      let status: SittingStatus;
      if (plan.state === 'LAPSED') status = 'LAPSED';
      else if (plan.state === 'EXPIRED') status = 'EXPIRED';
      else if (!dueDate) status = 'NO_DATE';
      else if (dueDate < today) status = 'OVERDUE';
      else if (dueDate === today) status = 'DUE_TODAY';
      else if (dueDate <= upcomingUntil) status = 'UPCOMING';
      else status = 'LATER';

      const allCalls = callsByPurchase.get(p.id) ?? [];
      const currentCalls = allCalls.filter((c) => c.dueDate === (dueDate ?? 'unknown'));
      const latest = currentCalls[0] ?? null;
      const appt = status === 'LAPSED' ? null : nextAppointment.get(p.patientId) ?? null;
      const inClinic = todaysQueue.find((q) => q.sittingPurchaseId === p.id) ?? todaysQueue.find((q) => q.patientId === p.patientId);

      // A sitting booked with the nurse/staff — no doctor slot. If the booked day
      // passes without the patient coming, it drops back to "needs a call".
      const sittingBooking =
        status !== 'LAPSED' && latest?.outcome === 'BOOKED' && latest.callBackOn && latest.callBackOn >= today ? latest : null;

      let followUp: SittingFollowUp;
      if (inClinic && status !== 'LAPSED') followUp = 'IN_CLINIC';
      else if (sittingBooking || appt) followUp = 'BOOKED';
      else if (latest?.outcome === 'DECLINED') followUp = 'DECLINED';
      else if (latest?.outcome === 'CALL_BACK' && latest.callBackOn && latest.callBackOn > today) followUp = 'CALL_BACK';
      else followUp = 'TO_CALL';

      const allSittingDates = p.items.flatMap((i) => i.sittings.map((s) => s.date)).sort();
      const totalSittings = plan.items.reduce((s, i) => s + i.totalSittings, 0);
      const sittingsUsed = plan.items.reduce((s, i) => s + i.sittingsUsed, 0);

      rows.push({
        purchaseId: p.id,
        patient: p.patient,
        packageName: p.packageName,
        purchaseDate: p.purchaseDate,
        expiryDate: plan.expiryDate,
        daysToExpiry: plan.daysToExpiry,
        extendedDays: plan.extendedDays,
        expiringSoon: plan.daysToExpiry !== null && plan.daysToExpiry >= 0 && plan.daysToExpiry <= EXPIRING_DAYS && status !== 'LAPSED',
        status,
        followUp,
        dueDate,
        overdueDays: dueDate && dueDate < today ? diffDays(dueDate, today) : 0,
        daysUntilDue: dueDate && dueDate >= today ? diffDays(today, dueDate) : null,
        nextTreatment: plan.nextTreatment,
        nextIsDoctorPlanned: plan.nextIsDoctorPlanned,
        sittingsUsed,
        totalSittings,
        lastSittingDate: allSittingDates[allSittingDates.length - 1] ?? null,
        lapsedAt: p.lapsedAt,
        treatments: plan.items.map((i) => ({
          id: i.id,
          name: i.name,
          sittingsUsed: i.sittingsUsed,
          totalSittings: i.totalSittings,
          gapDays: i.sittingGapDays,
          nextDate: i.sittingsRemaining > 0 ? i.plan.nextSittingDate : null,
          overdueDays: i.plan.overdueDays,
          schedule: i.plan.schedule,
        })),
        booking: sittingBooking
          ? { date: sittingBooking.callBackOn, time: sittingBooking.bookedTime, by: sittingBooking.calledBy?.name ?? null, note: sittingBooking.note }
          : null,
        appointment: appt ? { startTime: appt.startTime, doctorName: appt.doctor?.name ?? null, reason: appt.reasonForVisit } : null,
        inClinicStatus: inClinic?.status ?? null,
        attempts: currentCalls.filter((c) => c.outcome === 'NO_ANSWER').length,
        lastCall: latest ? { outcome: latest.outcome, callBackOn: latest.callBackOn, at: latest.createdAt, by: latest.calledBy?.name ?? null, note: latest.note } : null,
        calls: allCalls.slice(0, 30).map((c) => ({
          id: c.id, outcome: c.outcome, note: c.note, callBackOn: c.callBackOn, bookedTime: c.bookedTime, dueDate: c.dueDate, at: c.createdAt, by: c.calledBy?.name ?? null,
        })),
      });
    }

    // Most urgent first: missed the longest, then due today, then by date.
    const rank: Record<SittingStatus, number> = { OVERDUE: 0, DUE_TODAY: 1, EXPIRED: 2, LAPSED: 3, NO_DATE: 4, UPCOMING: 5, LATER: 6 };
    rows.sort((a, b) =>
      rank[a.status] - rank[b.status]
      || b.overdueDays - a.overdueDays
      || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
    );

    const needsCall = (r: BoardRow) =>
      r.followUp === 'TO_CALL' && ['OVERDUE', 'DUE_TODAY', 'EXPIRED', 'LAPSED', 'NO_DATE'].includes(r.status);

    return {
      today,
      counts: {
        needsCall: rows.filter(needsCall).length,
        overdue: rows.filter((r) => r.status === 'OVERDUE').length,
        dueToday: rows.filter((r) => r.status === 'DUE_TODAY').length,
        upcoming: rows.filter((r) => r.status === 'UPCOMING').length,
        expiring: rows.filter((r) => r.expiringSoon).length,
        expiredOrLapsed: rows.filter((r) => r.status === 'EXPIRED' || r.status === 'LAPSED').length,
        booked: rows.filter((r) => r.followUp === 'BOOKED' || r.followUp === 'IN_CLINIC').length,
        callBack: rows.filter((r) => r.followUp === 'CALL_BACK').length,
        declined: rows.filter((r) => r.followUp === 'DECLINED').length,
        all: rows.length,
      },
      rows,
    };
  }

  async summary(clinicId: string) {
    const { counts } = await this.board(clinicId);
    return { needsCall: counts.needsCall, overdue: counts.overdue, dueToday: counts.dueToday };
  }
}
