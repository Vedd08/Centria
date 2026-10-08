import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertSubscriptionDto } from './dto/upsert-subscription.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

const today = () => new Date().toISOString().split('T')[0];

/**
 * Moves a YYYY-MM-DD forward one month, clamped to the target month's length.
 *
 * Done entirely in UTC. Building a local Date and formatting with toISOString()
 * shifts the day backwards for anyone east of UTC — which silently moved every
 * Indian billing date one day earlier.
 */
function addMonth(date: string, billingDay: number): string {
  const [y, m] = date.split('-').map(Number);
  const targetMonth = m; // 0-indexed next month == 1-indexed current month
  const year = y + Math.floor(targetMonth / 12);
  const month = targetMonth % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(billingDay, lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The platform's own view of its business: which hospitals run on the software,
 * who owns each one, how much they use it, and whether they are paid up.
 */
@Injectable()
export class PlatformService {
  constructor(private prisma: PrismaService) {}

  /** Overdue is derived from the due date, so it is never stale. */
  private effectiveStatus(sub: { status: string; nextDueDate: string | null } | null): string {
    if (!sub) return 'NONE';
    if (['SUSPENDED', 'CANCELLED'].includes(sub.status)) return sub.status;
    if (sub.nextDueDate && sub.nextDueDate < today()) return 'OVERDUE';
    return sub.status;
  }

  async listHospitals() {
    const clinics = await this.prisma.clinic.findMany({
      include: { subscription: true },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      clinics.map(async (clinic) => {
        const [owners, staffCount, patients, visits, revenue, lastVisit] = await Promise.all([
          this.prisma.user.findMany({
            where: { clinicId: clinic.id, role: 'MASTER' },
            select: { id: true, name: true, email: true },
          }),
          this.prisma.user.count({ where: { clinicId: clinic.id } }),
          this.prisma.patient.count({ where: { clinicId: clinic.id } }),
          this.prisma.visit.count({ where: { clinicId: clinic.id } }),
          this.prisma.visit.aggregate({
            where: { clinicId: clinic.id },
            _sum: { cashAmount: true, bankAmount: true },
          }),
          this.prisma.visit.findFirst({
            where: { clinicId: clinic.id },
            orderBy: { date: 'desc' },
            select: { date: true },
          }),
        ]);

        return {
          id: clinic.id,
          name: clinic.name,
          address: clinic.address,
          phone: clinic.phone,
          email: clinic.email,
          isActive: clinic.isActive,
          owners,
          staffCount,
          patients,
          visits,
          revenue: Number(revenue._sum.cashAmount ?? 0) + Number(revenue._sum.bankAmount ?? 0),
          lastActivity: lastVisit?.date ?? null,
          subscription: clinic.subscription
            ? {
                ...clinic.subscription,
                monthlyFee: Number(clinic.subscription.monthlyFee),
                effectiveStatus: this.effectiveStatus(clinic.subscription),
              }
            : null,
        };
      }),
    );
  }

  /** The read-only report for one hospital. */
  async getHospital(id: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id },
      include: { subscription: { include: { payments: { orderBy: { paidOn: 'desc' }, take: 24 } } } },
    });
    if (!clinic) throw new NotFoundException(`Hospital ${id} not found`);

    const [staff, patients, visitsByType, revenue, admissions, stock, purchases, queueToday] = await Promise.all([
      this.prisma.user.findMany({
        where: { clinicId: id },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.patient.count({ where: { clinicId: id } }),
      this.prisma.visit.groupBy({ by: ['visitType'], where: { clinicId: id }, _count: { _all: true } }),
      this.prisma.visit.aggregate({
        where: { clinicId: id },
        _sum: { cashAmount: true, bankAmount: true },
      }),
      this.prisma.admission.count({ where: { clinicId: id, status: 'ADMITTED' } }),
      this.prisma.medicine.findMany({ where: { clinicId: id }, select: { stockQty: true, unitPrice: true } }),
      this.prisma.purchase.aggregate({ where: { clinicId: id }, _sum: { totalValue: true }, _count: { _all: true } }),
      this.prisma.patientQueue.count({ where: { clinicId: id, queueDate: today() } }),
    ]);

    const sub = clinic.subscription;

    return {
      id: clinic.id,
      name: clinic.name,
      address: clinic.address,
      phone: clinic.phone,
      email: clinic.email,
      isActive: clinic.isActive,
      createdAt: clinic.createdAt,
      usage: {
        patients,
        visitsOpd: visitsByType.find((v) => v.visitType === 'OPD')?._count._all ?? 0,
        visitsIpd: visitsByType.find((v) => v.visitType === 'IPD')?._count._all ?? 0,
        revenue: Number(revenue._sum.cashAmount ?? 0) + Number(revenue._sum.bankAmount ?? 0),
        currentlyAdmitted: admissions,
        queueToday,
        stockValue: stock.reduce((a, m) => a + m.stockQty * Number(m.unitPrice), 0),
        purchaseTotal: Number(purchases._sum.totalValue ?? 0),
        purchaseCount: purchases._count._all,
        staffCount: staff.length,
      },
      staff,
      subscription: sub
        ? {
            ...sub,
            monthlyFee: Number(sub.monthlyFee),
            effectiveStatus: this.effectiveStatus(sub),
            payments: sub.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
            paidToDate: sub.payments.reduce((a, p) => a + Number(p.amount), 0),
          }
        : null,
    };
  }

  async upsertSubscription(clinicId: string, dto: UpsertSubscriptionDto) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundException(`Hospital ${clinicId} not found`);

    const startedOn = dto.startedOn || today();
    const billingDay = dto.billingDay ?? 1;

    const data = {
      planName: dto.planName,
      monthlyFee: dto.monthlyFee,
      currency: dto.currency ?? 'INR',
      status: dto.status ?? 'ACTIVE',
      startedOn,
      billingDay,
      nextDueDate: dto.nextDueDate ?? addMonth(startedOn, billingDay),
      notes: dto.notes,
    };

    return this.prisma.subscription.upsert({
      where: { clinicId },
      update: data,
      create: { clinicId, ...data },
    });
  }

  /**
   * Records a payment and rolls the due date forward, so "who owes us money"
   * stays correct without anyone maintaining it by hand.
   */
  async recordPayment(clinicId: string, dto: RecordPaymentDto, requestingUser: any) {
    const sub = await this.prisma.subscription.findUnique({ where: { clinicId } });
    if (!sub) {
      throw new BadRequestException('Set up a subscription for this hospital before recording payments');
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.subscriptionPayment.create({
        data: {
          subscriptionId: sub.id,
          clinicId,
          amount: dto.amount,
          paidOn: dto.paidOn || today(),
          periodFrom: dto.periodFrom,
          periodTo: dto.periodTo,
          method: dto.method ?? 'bank',
          reference: dto.reference,
          notes: dto.notes,
          recordedById: requestingUser.id,
        },
      });

      const base = sub.nextDueDate && sub.nextDueDate > (dto.paidOn || today()) ? sub.nextDueDate : today();
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          nextDueDate: addMonth(base, sub.billingDay),
          status: ['SUSPENDED', 'CANCELLED'].includes(sub.status) ? sub.status : 'ACTIVE',
        },
      });

      return payment;
    });
  }

  /** What the platform itself is earning. */
  async getPlatformRevenue() {
    const [subs, payments] = await Promise.all([
      this.prisma.subscription.findMany({ include: { clinic: { select: { name: true } } } }),
      this.prisma.subscriptionPayment.findMany({ select: { amount: true, paidOn: true } }),
    ]);

    const withStatus = subs.map((s) => ({ ...s, effectiveStatus: this.effectiveStatus(s) }));
    const active = withStatus.filter((s) => ['ACTIVE', 'OVERDUE'].includes(s.effectiveStatus));
    const thisMonth = new Date().toISOString().slice(0, 7);

    return {
      hospitals: subs.length,
      activeSubscriptions: active.length,
      mrr: active.reduce((a, s) => a + Number(s.monthlyFee), 0),
      overdue: withStatus
        .filter((s) => s.effectiveStatus === 'OVERDUE')
        .map((s) => ({
          clinicId: s.clinicId,
          name: s.clinic.name,
          monthlyFee: Number(s.monthlyFee),
          dueSince: s.nextDueDate,
        })),
      collectedAllTime: payments.reduce((a, p) => a + Number(p.amount), 0),
      collectedThisMonth: payments
        .filter((p) => p.paidOn.startsWith(thisMonth))
        .reduce((a, p) => a + Number(p.amount), 0),
    };
  }
}
