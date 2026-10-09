import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getRevenueStats(clinicId: string, from?: string, to?: string) {
    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const toDate = to ? new Date(to + 'T23:59:59.999Z') : new Date();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        clinicId,
        issuedAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { issuedAt: 'asc' },
    });

    // Group by month
    const monthly: Record<string, { month: string; total: number; count: number }> = {};
    for (const inv of invoices) {
      const key = inv.issuedAt.toISOString().slice(0, 7); // YYYY-MM
      if (!monthly[key]) monthly[key] = { month: key, total: 0, count: 0 };
      monthly[key].total += Number(inv.totalAmount);
      monthly[key].count += 1;
    }

    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalInvoices = invoices.length;

    return {
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
      totalRevenue,
      totalInvoices,
      averagePerInvoice: totalInvoices > 0 ? Math.round(totalRevenue / totalInvoices) : 0,
      monthlyBreakdown: Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  async getPatientStats(clinicId: string) {
    const patients = await this.prisma.patient.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
    });

    // Group by month registered
    const monthly: Record<string, { month: string; count: number }> = {};
    for (const p of patients) {
      const key = p.createdAt.toISOString().slice(0, 7);
      if (!monthly[key]) monthly[key] = { month: key, count: 0 };
      monthly[key].count += 1;
    }

    // Gender distribution
    const genderDist = { Male: 0, Female: 0, Other: 0 };
    for (const p of patients) {
      const g = p.gender as keyof typeof genderDist;
      if (genderDist[g] !== undefined) genderDist[g]++;
    }

    return {
      totalPatients: patients.length,
      genderDistribution: genderDist,
      monthlyRegistrations: Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  async getTreatmentStats(clinicId: string) {
    const visits = await this.prisma.visit.findMany({
      where: { clinicId },
      include: { treatment: true },
    });

    // Most popular treatments
    const treatmentCounts: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const v of visits) {
      if (!treatmentCounts[v.treatmentName]) {
        treatmentCounts[v.treatmentName] = { name: v.treatmentName, count: 0, revenue: 0 };
      }
      treatmentCounts[v.treatmentName].count += 1;
      treatmentCounts[v.treatmentName].revenue += Number(v.treatmentPrice);
    }

    // Referral sources
    const patients = await this.prisma.patient.findMany({ where: { clinicId } });
    const referralSources: Record<string, number> = {};
    for (const p of patients) {
      if (p.howHeardAboutUs) {
        const source = p.howHeardAboutUs.trim() || 'Unknown';
        referralSources[source] = (referralSources[source] || 0) + 1;
      }
    }

    return {
      totalVisits: visits.length,
      newVisits: visits.filter((v) => v.status === 'New').length,
      followUpVisits: visits.filter((v) => v.status === 'Follow Up').length,
      topTreatments: Object.values(treatmentCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      referralSources: Object.entries(referralSources)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /**
   * What the clinic actually took in, split the way an accountant asks for it:
   * by day, by payment mode, by GST rate, and by what was sold.
   */
  async getCollections(clinicId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.dateWindow(from, to);

    const invoices = await this.prisma.invoice.findMany({
      where: { clinicId, issuedAt: { gte: fromDate, lte: toDate } },
      orderBy: { issuedAt: 'asc' },
    });

    const daily = new Map<string, { date: string; cash: number; bank: number; total: number; count: number }>();
    const byRate = new Map<number, { rate: number; taxableValue: number; cgst: number; sgst: number; tax: number; total: number; count: number }>();
    const bySource = new Map<string, { source: string; count: number; total: number }>();
    let cash = 0;
    let bank = 0;
    let unreconciledCount = 0;
    let unreconciledAmount = 0;

    for (const inv of invoices) {
      const amount = Number(inv.totalAmount);
      const date = inv.issuedAt.toISOString().slice(0, 10);

      const day = daily.get(date) ?? { date, cash: 0, bank: 0, total: 0, count: 0 };
      day.total += amount;
      day.count += 1;
      if (inv.paymentMethod === 'cash') {
        day.cash += amount;
        cash += amount;
      } else {
        day.bank += amount;
        bank += amount;
      }
      daily.set(date, day);

      // CGST and SGST are each half the item's rate, so the pair is the filing rate.
      const rate = Number(inv.cgstRate) + Number(inv.sgstRate);
      const bucket = byRate.get(rate) ?? { rate, taxableValue: 0, cgst: 0, sgst: 0, tax: 0, total: 0, count: 0 };
      bucket.taxableValue += Number(inv.taxableValue);
      bucket.cgst += Number(inv.cgst);
      bucket.sgst += Number(inv.sgst);
      bucket.tax = bucket.cgst + bucket.sgst;
      bucket.total += amount;
      bucket.count += 1;
      byRate.set(rate, bucket);

      const source = inv.retailSaleId
        ? 'Pharmacy retail'
        : inv.packagePurchaseId
          ? 'Package'
          : inv.visitId
            ? 'Treatment'
            : 'Other';
      const src = bySource.get(source) ?? { source, count: 0, total: 0 };
      src.count += 1;
      src.total += amount;
      bySource.set(source, src);

      if (!inv.reconciled) {
        unreconciledCount += 1;
        unreconciledAmount += amount;
      }
    }

    return {
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
      totals: {
        cash: this.round2(cash),
        bank: this.round2(bank),
        total: this.round2(cash + bank),
        count: invoices.length,
      },
      daily: [...daily.values()].map((d) => ({
        ...d,
        cash: this.round2(d.cash),
        bank: this.round2(d.bank),
        total: this.round2(d.total),
      })),
      gstByRate: [...byRate.values()]
        .map((b) => ({
          ...b,
          taxableValue: this.round2(b.taxableValue),
          cgst: this.round2(b.cgst),
          sgst: this.round2(b.sgst),
          tax: this.round2(b.tax),
          total: this.round2(b.total),
        }))
        .sort((a, b) => a.rate - b.rate),
      bySource: [...bySource.values()]
        .map((s) => ({ ...s, total: this.round2(s.total) }))
        .sort((a, b) => b.total - a.total),
      unreconciled: { count: unreconciledCount, amount: this.round2(unreconciledAmount) },
    };
  }

  /**
   * Who did the work and who earned on it: consultations and revenue per doctor,
   * and commission per relationship manager (and every other commission role).
   */
  async getDoctorPerformance(clinicId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.dateWindow(from, to);
    const fromKey = this.isoDate(fromDate);
    const toKey = this.isoDate(toDate);

    const [visits, commissionRecords] = await Promise.all([
      // Visit.date is a YYYY-MM-DD string, which sorts and ranges correctly as text.
      this.prisma.visit.findMany({
        where: { clinicId, date: { gte: fromKey, lte: toKey } },
        include: { doctor: { select: { id: true, name: true } } },
      }),
      this.prisma.commissionRecord.findMany({
        where: { clinicId, createdAt: { gte: fromDate, lte: toDate } },
      }),
    ]);

    const byDoctor = new Map<
      string,
      { id: string; name: string; visits: number; revenue: number; newVisits: number; followUps: number; treatments: Map<string, number> }
    >();

    for (const v of visits) {
      const id = v.doctorId;
      const row =
        byDoctor.get(id) ??
        { id, name: v.doctor?.name ?? 'Unknown', visits: 0, revenue: 0, newVisits: 0, followUps: 0, treatments: new Map<string, number>() };
      row.visits += 1;
      row.revenue += Number(v.treatmentPrice);
      if (v.status === 'New') row.newVisits += 1;
      if (v.status === 'Follow Up') row.followUps += 1;
      row.treatments.set(v.treatmentName, (row.treatments.get(v.treatmentName) ?? 0) + 1);
      byDoctor.set(id, row);
    }

    const byBeneficiary = new Map<string, { beneficiaryName: string; role: string; amount: number; count: number }>();
    for (const rec of commissionRecords) {
      const key = `${rec.role}::${rec.beneficiaryName}`;
      const row = byBeneficiary.get(key) ?? { beneficiaryName: rec.beneficiaryName, role: rec.role, amount: 0, count: 0 };
      row.amount += Number(rec.calculatedAmount);
      row.count += 1;
      byBeneficiary.set(key, row);
    }

    const doctors = [...byDoctor.values()]
      .map((d) => {
        const top = [...d.treatments.entries()].sort((a, b) => b[1] - a[1])[0];
        return {
          id: d.id,
          name: d.name,
          visits: d.visits,
          revenue: this.round2(d.revenue),
          newVisits: d.newVisits,
          followUps: d.followUps,
          averagePerVisit: d.visits > 0 ? this.round2(d.revenue / d.visits) : 0,
          topTreatment: top ? { name: top[0], count: top[1] } : null,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const commissions = [...byBeneficiary.values()]
      .map((c) => ({ ...c, amount: this.round2(c.amount) }))
      .sort((a, b) => b.amount - a.amount);

    return {
      from: fromKey,
      to: toKey,
      doctors,
      commissions,
      totals: {
        visits: visits.length,
        revenue: this.round2(doctors.reduce((sum, d) => sum + d.revenue, 0)),
        commission: this.round2(commissions.reduce((sum, c) => sum + c.amount, 0)),
      },
    };
  }

  /**
   * What is on the shelf and what it is worth — including the stock that is about to
   * become worthless, which is the number a pharmacy acts on soonest.
   */
  async getPharmacyStats(clinicId: string, days = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const today = new Date().toISOString().slice(0, 10);

    const [medicines, movements] = await Promise.all([
      this.prisma.medicine.findMany({
        where: { clinicId, isActive: true },
        include: { batches: true },
      }),
      this.prisma.stockMovement.findMany({
        where: { clinicId, createdAt: { gte: since } },
        include: { medicine: { select: { name: true } } },
      }),
    ]);

    let retailValue = 0;
    let batchCostValue = 0;
    const lowStock: { name: string; stockQty: number; reorderPoint: number; shortfall: number }[] = [];
    const buckets = [
      { bucket: 'Expired', within: 0, quantity: 0, value: 0 },
      { bucket: 'Within 30 days', within: 30, quantity: 0, value: 0 },
      { bucket: '31–60 days', within: 60, quantity: 0, value: 0 },
      { bucket: '61–90 days', within: 90, quantity: 0, value: 0 },
      { bucket: 'Over 90 days', within: Infinity, quantity: 0, value: 0 },
    ];

    for (const m of medicines) {
      retailValue += m.stockQty * Number(m.unitPrice);
      if (m.stockQty <= m.reorderPoint) {
        lowStock.push({
          name: m.name,
          stockQty: m.stockQty,
          reorderPoint: m.reorderPoint,
          shortfall: m.reorderPoint - m.stockQty,
        });
      }

      for (const b of m.batches) {
        if (b.currentQty <= 0) continue;
        const value = b.currentQty * Number(b.costPrice);
        batchCostValue += value;
        if (!b.expiryDate) continue;
        const daysLeft = Math.floor(
          (new Date(b.expiryDate).getTime() - new Date(today).getTime()) / 86_400_000,
        );
        const bucket =
          daysLeft < 0
            ? buckets[0]
            : daysLeft <= 30
              ? buckets[1]
              : daysLeft <= 60
                ? buckets[2]
                : daysLeft <= 90
                  ? buckets[3]
                  : buckets[4];
        bucket.quantity += b.currentQty;
        bucket.value += value;
      }
    }

    const dispensed = new Map<string, { name: string; quantity: number }>();
    let retailUnits = 0;
    let clinicalUnits = 0;
    for (const mv of movements) {
      if (mv.delta >= 0) continue;
      const units = Math.abs(mv.delta);
      const row = dispensed.get(mv.medicineId) ?? { name: mv.medicine?.name ?? 'Unknown', quantity: 0 };
      row.quantity += units;
      dispensed.set(mv.medicineId, row);
      if (mv.reason === 'Retail Sale') retailUnits += units;
      else clinicalUnits += units;
    }

    const moving = new Set(dispensed.keys());

    return {
      windowDays: days,
      valuation: {
        retailValue: this.round2(retailValue),
        batchCostValue: this.round2(batchCostValue),
        items: medicines.length,
      },
      expiry: buckets.map((b) => ({ bucket: b.bucket, quantity: b.quantity, value: this.round2(b.value) })),
      lowStock: lowStock.sort((a, b) => b.shortfall - a.shortfall).slice(0, 10),
      topMovers: [...dispensed.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
      // Stocked, still active, and not dispensed once in the window — money sitting still.
      stagnant: medicines
        .filter((m) => !moving.has(m.id) && m.stockQty > 0)
        .map((m) => ({ name: m.name, stockQty: m.stockQty, value: this.round2(m.stockQty * Number(m.unitPrice)) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
      dispensingMix: [
        { channel: 'Retail counter', units: retailUnits },
        { channel: 'Clinical / ward', units: clinicalUnits },
      ],
    };
  }

  /**
   * How the day actually ran: how long patients waited, what the load looked like,
   * and whether the follow-ups the doctor asked for came back.
   */
  async getPatientFlow(clinicId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.dateWindow(from, to);
    const fromKey = this.isoDate(fromDate);
    const toKey = this.isoDate(toDate);

    const entries = await this.prisma.patientQueue.findMany({
      where: { clinicId, queueDate: { gte: fromKey, lte: toKey } },
      select: {
        patientId: true,
        queueDate: true,
        status: true,
        careType: true,
        isRegular: true,
        checkedInAt: true,
        seenAt: true,
        completedAt: true,
        nextAppointmentDate: true,
      },
    });

    const waits: number[] = [];
    const daily = new Map<string, { date: string; opd: number; ipd: number; total: number; waitSum: number; waitCount: number }>();
    const statusMix = new Map<string, number>();
    let returning = 0;

    for (const e of entries) {
      const day = daily.get(e.queueDate) ?? { date: e.queueDate, opd: 0, ipd: 0, total: 0, waitSum: 0, waitCount: 0 };
      day.total += 1;
      if (e.careType === 'IPD') day.ipd += 1;
      else day.opd += 1;

      if (e.seenAt) {
        const minutes = (e.seenAt.getTime() - e.checkedInAt.getTime()) / 60_000;
        // A negative wait means the clock was corrected after check-in; drop it.
        if (minutes >= 0) {
          waits.push(minutes);
          day.waitSum += minutes;
          day.waitCount += 1;
        }
      }
      daily.set(e.queueDate, day);

      statusMix.set(e.status, (statusMix.get(e.status) ?? 0) + 1);
      if (e.isRegular) returning += 1;
    }

    const sorted = [...waits].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

    // Did the follow-ups the doctor asked for actually come back? Only ones already
    // due can be judged, and a fortnight's grace keeps a late return counted as kept.
    const scheduled = entries.filter((e) => e.nextAppointmentDate);
    const due = scheduled.filter((e) => e.nextAppointmentDate! <= toKey);
    let kept = 0;
    if (due.length > 0) {
      const patientIds = [...new Set(due.map((e) => e.patientId))];
      const later = await this.prisma.patientQueue.findMany({
        where: { clinicId, patientId: { in: patientIds }, queueDate: { gte: fromKey } },
        select: { patientId: true, queueDate: true },
      });
      const byPatient = new Map<string, string[]>();
      for (const l of later) {
        const list = byPatient.get(l.patientId) ?? [];
        list.push(l.queueDate);
        byPatient.set(l.patientId, list);
      }
      for (const e of due) {
        const target = e.nextAppointmentDate!;
        const grace = new Date(target);
        grace.setDate(grace.getDate() + 14);
        const graceKey = grace.toISOString().slice(0, 10);
        const returned = (byPatient.get(e.patientId) ?? []).some((d) => d >= target && d <= graceKey);
        if (returned) kept += 1;
      }
    }

    return {
      from: fromKey,
      to: toKey,
      totals: {
        encounters: entries.length,
        newPatients: entries.length - returning,
        returningPatients: returning,
      },
      wait: {
        averageMinutes: waits.length ? Math.round(waits.reduce((s, w) => s + w, 0) / waits.length) : 0,
        medianMinutes: Math.round(median),
        longestMinutes: sorted.length ? Math.round(sorted[sorted.length - 1]) : 0,
        measured: waits.length,
      },
      daily: [...daily.values()]
        .map((d) => ({
          date: d.date,
          opd: d.opd,
          ipd: d.ipd,
          total: d.total,
          averageWaitMinutes: d.waitCount ? Math.round(d.waitSum / d.waitCount) : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      statusMix: [...statusMix.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
      followUps: {
        scheduled: scheduled.length,
        due: due.length,
        kept,
        adherenceRate: due.length ? Math.round((kept / due.length) * 100) : 0,
      },
    };
  }

  /**
   * YYYY-MM-DD in the server's own timezone.
   *
   * `toISOString()` converts to UTC first, so east of Greenwich a local midnight lands
   * on the previous day — which quietly pulled an extra day into every range.
   */
  private isoDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /** Reports default to the current month to date when no range is given. */
  private dateWindow(from?: string, to?: string) {
    const now = new Date();
    return {
      fromDate: from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1),
      toDate: to ? new Date(to + 'T23:59:59.999Z') : new Date(),
    };
  }

  /** Money is summed as floats here, so round once on the way out. */
  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }
}
