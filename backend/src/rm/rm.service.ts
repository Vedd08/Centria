import { toLocalDateKey } from '../common/date.helper';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TRANSACTION_OPTIONS } from '../prisma/transaction-options';
import { CommissionsService } from '../commissions/commissions.service';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { textContains } from '../common/text-search';

/** Roles that may act as, or report on, a relationship manager. */
const RM_ROLES = ['RM', 'MASTER', 'SUPER_ADMIN'];

/** A client with no visit in this many days has gone quiet and is worth a call. */
const LAPSED_AFTER_DAYS = 60;

const dayString = (d: Date) => toLocalDateKey(d);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return dayString(d);
};

/**
 * The relationship manager's book of business.
 *
 * In an aesthetic practice the RM owns the client rather than the clinical
 * episode: they convert the enquiry, keep the client returning for the sittings
 * they have already paid for, and earn a share of what they bring in. So this
 * desk is organised around who needs calling today, not around today's queue —
 * follow-ups that have come due, packages with sittings left unused, and
 * clients who have gone quiet.
 */
@Injectable()
export class RmService {
  constructor(
    private prisma: PrismaService,
    private commissions: CommissionsService,
    private followUpsService: FollowUpsService,
  ) {}

  /** Admins may inspect any RM's desk; an RM only ever sees their own. */
  private async resolveRm(clinicId: string, requestedRmId: string | undefined, user: any) {
    if (!RM_ROLES.includes(user.role)) {
      throw new ForbiddenException('This desk belongs to the relationship management team');
    }

    const isAdmin = ['MASTER', 'SUPER_ADMIN'].includes(user.role);
    const targetId = isAdmin && requestedRmId ? requestedRmId : user.id;

    if (!isAdmin && requestedRmId && requestedRmId !== user.id) {
      throw new ForbiddenException("You can only open your own desk");
    }

    const rm = await this.prisma.user.findFirst({
      where: { id: targetId, clinicId },
      select: { id: true, name: true, role: true },
    });
    if (!rm) throw new NotFoundException('Relationship manager not found in this clinic');
    return rm;
  }

  async getDesk(clinicId: string, requestedRmId: string | undefined, user: any) {
    const rm = await this.resolveRm(clinicId, requestedRmId, user);
    const today = dayString(new Date());
    const monthStart = today.slice(0, 8) + '01';

    const mine = { clinicId, rmId: rm.id };

    const [myVisits, monthAgg, allAgg, commissionRows] = await Promise.all([
      this.prisma.visit.findMany({
        where: mine,
        select: { patientId: true, date: true, nextAppointmentDate: true },
      }),
      // Business is measured by what the client actually paid, not the list price
      // on the treatment card: the day books record the money taken per visit and
      // most rows were imported without a catalogue price ever being set.
      this.prisma.visit.aggregate({
        where: { ...mine, date: { gte: monthStart } },
        _sum: { cashAmount: true, bankAmount: true },
        _count: true,
      }),
      this.prisma.visit.aggregate({
        where: mine,
        _sum: { cashAmount: true, bankAmount: true },
        _count: true,
      }),
      this.prisma.commissionRecord.findMany({
        where: { clinicId, role: 'RM', beneficiaryName: rm.name },
        select: { calculatedAmount: true, visitId: true },
      }),
    ]);

    const clientIds = [...new Set(myVisits.map((v) => v.patientId))];

    // Commission is read from the ledger the accounts team works off, rather than
    // recomputed here — two figures for the same money is how disputes start.
    // Keep each client's most recent visit — "gone quiet" is judged from the last
    // time they came in, and a plain Map over unordered rows keeps whichever row
    // happened to be read last.
    const visitDates = new Map<string, string>();
    for (const v of myVisits) {
      const seen = visitDates.get(v.patientId);
      if (!seen || v.date > seen) visitDates.set(v.patientId, v.date);
    }
    const commissionTotal = commissionRows.reduce((a, r) => a + Number(r.calculatedAmount), 0);
    const monthVisitIds = new Set(
      (
        await this.prisma.visit.findMany({
          where: { ...mine, date: { gte: monthStart } },
          select: { id: true },
        })
      ).map((v) => v.id),
    );
    const commissionThisMonth = commissionRows
      .filter((r) => monthVisitIds.has(r.visitId))
      .reduce((a, r) => a + Number(r.calculatedAmount), 0);

    // --- Follow-ups via the shared service, scoped to this RM ---
    const followUpBuckets = await this.followUpsService.getFollowUps(clinicId, { rmId: rm.id });
    // Flatten buckets back to a flat dueList for the RM desk's existing shape
    const dueList = [
      ...followUpBuckets.overdue,
      ...followUpBuckets.today,
      ...followUpBuckets.next7Days,
    ].flatMap(item => item.reasons.map(r => ({
      id: r.refId,
      nextAppointmentDate: r.dueDate,
      treatmentName: r.label,
      patient: item.patient,
      overdueDays: r.overdueDays,
    })));

    // --- Packages with sittings still owed to the client ---
    const packagesOwed = clientIds.length
      ? await this.prisma.packagePurchase.findMany({
          where: { clinicId, patientId: { in: clientIds }, sittingsRemaining: { gt: 0 } },
          select: {
            id: true,
            packageName: true,
            purchaseDate: true,
            totalSittings: true,
            sittingsUsed: true,
            sittingsRemaining: true,
            amountPaid: true,
            patient: { select: { id: true, name: true, phone: true } },
          },
          orderBy: { purchaseDate: 'asc' },
          take: 50,
        })
      : [];

    // --- Clients who have gone quiet ---
    const cutoff = daysAgo(LAPSED_AFTER_DAYS);
    const lapsed = clientIds
      .filter((id) => (visitDates.get(id) ?? '9999') < cutoff)
      .slice(0, 50);
    const lapsedClients = lapsed.length
      ? await this.prisma.patient.findMany({
          where: { id: { in: lapsed }, clinicId },
          select: { id: true, name: true, phone: true, uhid: true },
        })
      : [];

    // --- Patients nobody has claimed yet ---
    const unclaimed = await this.prisma.patient.findMany({
      where: { clinicId, visits: { none: { rmId: { not: null } } } },
      select: { id: true, name: true, phone: true, uhid: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    const unclaimedTotal = await this.prisma.patient.count({
      where: { clinicId, visits: { none: { rmId: { not: null } } } },
    });

    return {
      rm,
      stats: {
        clients: clientIds.length,
        visitsThisMonth: monthAgg._count,
        visitsAllTime: allAgg._count,
        revenueThisMonth:
          Number(monthAgg._sum.cashAmount ?? 0) + Number(monthAgg._sum.bankAmount ?? 0),
        revenueAllTime: Number(allAgg._sum.cashAmount ?? 0) + Number(allAgg._sum.bankAmount ?? 0),
        commissionThisMonth,
        commissionAllTime: commissionTotal,
        followUpsDue: dueList.length,
        packagesOwed: packagesOwed.length,
        lapsedClients: lapsedClients.length,
        unclaimedTotal,
      },
      followUpsDue: dueList,
      packagesOwed: packagesOwed.map((p) => ({ ...p, amountPaid: Number(p.amountPaid) })),
      lapsedClients: lapsedClients.map((c) => ({ ...c, lastVisit: visitDates.get(c.id) ?? null })),
      unclaimed,
    };
  }

  /** The RM's client list, with enough context to make the call. */
  async getClients(clinicId: string, requestedRmId: string | undefined, user: any, search?: string) {
    const rm = await this.resolveRm(clinicId, requestedRmId, user);
    const term = search?.trim();

    const visits = await this.prisma.visit.findMany({
      where: {
        clinicId,
        rmId: rm.id,
        ...(term
          ? { patient: { OR: [{ name: textContains(term) }, { phone: textContains(term) }] } }
          : {}),
      },
      select: {
        patientId: true,
        date: true,
        treatmentName: true,
        cashAmount: true,
        bankAmount: true,
        patient: { select: { id: true, name: true, phone: true, uhid: true } },
      },
      orderBy: { date: 'desc' },
    });

    // Collapse the visit rows into one line per client.
    const byPatient = new Map<string, any>();
    for (const v of visits) {
      const existing = byPatient.get(v.patientId);
      if (existing) {
        existing.visits += 1;
        existing.totalValue += Number(v.cashAmount) + Number(v.bankAmount);
      } else {
        byPatient.set(v.patientId, {
          ...v.patient,
          visits: 1,
          totalValue: Number(v.cashAmount) + Number(v.bankAmount),
          lastVisit: v.date,
          lastTreatment: v.treatmentName,
        });
      }
    }
    return [...byPatient.values()];
  }

  /**
   * Claims a patient for a relationship manager by stamping their whole visit
   * history. Commissions are recalculated through the same engine the day book
   * uses, so an RM share appears on exactly the visits that qualify for one.
   */
  async assignPatient(clinicId: string, patientId: string, targetRmId: string | undefined, user: any) {
    const rm = await this.resolveRm(clinicId, targetRmId, user);

    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, clinicId } });
    if (!patient) throw new NotFoundException('Patient not found in this clinic');

    const visits = await this.prisma.visit.findMany({
      where: { clinicId, patientId },
      select: { id: true },
    });
    if (visits.length === 0) {
      throw new BadRequestException(
        `${patient.name} has no recorded visits yet, so there is nothing to attribute. They will be assigned once their first visit is logged.`,
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.visit.updateMany({ where: { clinicId, patientId }, data: { rmId: rm.id } });
      },
      TRANSACTION_OPTIONS,
    );

    // Outside the transaction: commission recalculation is per-visit and its own
    // unit of work, and a slow rebuild should not hold the visit rows locked.
    for (const v of visits) {
      await this.commissions.recalculateForVisit(clinicId, v.id);
    }

    return { patientId, rmId: rm.id, rmName: rm.name, visitsAttributed: visits.length };
  }

  /** Releases a patient, so another manager can pick them up. */
  async releasePatient(clinicId: string, patientId: string, user: any) {
    if (!['MASTER', 'SUPER_ADMIN', 'RM'].includes(user.role)) {
      throw new ForbiddenException('Only the relationship management team can release a client');
    }
    const visits = await this.prisma.visit.findMany({
      where: { clinicId, patientId, rmId: { not: null } },
      select: { id: true },
    });
    await this.prisma.visit.updateMany({ where: { clinicId, patientId }, data: { rmId: null } });
    for (const v of visits) {
      await this.commissions.recalculateForVisit(clinicId, v.id);
    }
    return { patientId, released: true, visitsUpdated: visits.length };
  }

  /** Every RM in the clinic, for the admin's picker. */
  async listManagers(clinicId: string) {
    return this.prisma.user.findMany({
      where: { clinicId, role: 'RM' },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }
}
