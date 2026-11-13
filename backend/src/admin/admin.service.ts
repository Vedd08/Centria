import { toLocalDateKey } from '../common/date.helper';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeRevenue, getRevenueLedgerRows } from '../common/revenue';
import { normalizeRole, NURSE_STAFF_ROLES } from '../common/roles';

const STOCK_BACKED = ['MEDICINE', 'INJECTION'];
const DOCTOR_ROLES = ['DOCTOR', 'MASTER', 'SUPER_ADMIN'];
const FLOOR_ROLES = NURSE_STAFF_ROLES;

const monthsAgo = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return toLocalDateKey(d);
};
const today = () => toLocalDateKey(new Date());

/**
 * Read-only management reporting for the owner/admin: who did what, what it earned,
 * and what the clinic holds. Every figure is derived from the operational tables so
 * there is nothing extra to keep in step.
 */
@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getOverview(clinicId: string) {
    const [patients, visits, admissions, users, medicines, purchases, invoices, queueToday] = await Promise.all([
      this.prisma.patient.count({ where: { clinicId } }),
      this.prisma.visit.groupBy({ by: ['visitType'], where: { clinicId }, _count: { _all: true } }),
      this.prisma.admission.count({ where: { clinicId, status: 'ADMITTED' } }),
      this.prisma.user.groupBy({ by: ['role'], where: { clinicId }, _count: { _all: true } }),
      this.prisma.medicine.findMany({ where: { clinicId }, select: { stockQty: true, reorderPoint: true, unitPrice: true } }),
      this.prisma.purchase.aggregate({ where: { clinicId }, _sum: { totalValue: true }, _count: { _all: true } }),
      this.prisma.invoice.aggregate({ where: { clinicId }, _sum: { totalAmount: true }, _count: { _all: true } }),
      this.prisma.patientQueue.count({ where: { clinicId, queueDate: today() } }),
    ]);

    const revenueTotals = await computeRevenue(this.prisma, clinicId);

    return {
      patients,
      visitsOpd: visits.find((v) => v.visitType === 'OPD')?._count._all ?? 0,
      visitsIpd: visits.find((v) => v.visitType === 'IPD')?._count._all ?? 0,
      currentlyAdmitted: admissions,
      queueToday,
      // Older STAFF accounts are counted with NURSE — it is one role now.
      staffByRole: users.reduce<Record<string, number>>((acc, u) => {
        const role = normalizeRole(u.role);
        acc[role] = (acc[role] ?? 0) + u._count._all;
        return acc;
      }, {}),
      lifetimeRevenue: revenueTotals.total,
      invoiceTotal: Number(invoices._sum.totalAmount ?? 0),
      invoiceCount: invoices._count._all,
      purchaseTotal: Math.round(Number(purchases._sum.totalValue ?? 0) * 100) / 100,
      purchaseCount: purchases._count._all,
      medicineCount: medicines.length,
      stockValue: medicines.reduce((a, m) => a + m.stockQty * Number(m.unitPrice), 0),
      lowStockCount: medicines.filter((m) => m.stockQty <= m.reorderPoint).length,
    };
  }

  /** Per-doctor activity: how much they saw and what it brought in. */
  async getDoctorRecords(clinicId: string, from?: string, to?: string) {
    const fromDate = from || monthsAgo(12);
    const toDate = to || today();

    const doctors = await this.prisma.user.findMany({
      where: { clinicId, role: { in: DOCTOR_ROLES } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      doctors.map(async (doc) => {
        const [visitAgg, distinctPatients, feeAgg, templates, procedureVisits, procedureOrders] = await Promise.all([
          this.prisma.visit.aggregate({
            where: { clinicId, doctorId: doc.id, date: { gte: fromDate, lte: toDate } },
            _sum: { cashAmount: true, bankAmount: true },
            _count: { _all: true },
          }),
          this.prisma.visit.findMany({
            where: { clinicId, doctorId: doc.id, date: { gte: fromDate, lte: toDate } },
            select: { patientId: true },
            distinct: ['patientId'],
          }),
          this.prisma.patientQueue.aggregate({
            where: { clinicId, doctorId: doc.id, queueDate: { gte: fromDate, lte: toDate } },
            _sum: { consultationFee: true },
            _count: { _all: true },
          }),
          this.prisma.prescriptionTemplate.count({ where: { clinicId, doctorId: doc.id } }),
          // A procedure is either the treatment logged on the day-book visit, or a
          // procedure line the doctor ordered during the consultation.
          this.prisma.visit.count({
            where: { clinicId, doctorId: doc.id, treatmentId: { not: null }, date: { gte: fromDate, lte: toDate } },
          }),
          this.prisma.careOrder.findMany({
            where: {
              clinicId,
              orderedById: doc.id,
              orderType: 'TREATMENT',
              status: { not: 'CANCELLED' },
              queue: { queueDate: { gte: fromDate, lte: toDate } },
            },
            select: { treatmentId: true, queue: { select: { visit: { select: { treatmentId: true, doctorId: true } } } } },
          }),
        ]);

        // Don't count the same procedure twice when the doctor both logged it on the
        // visit and added it as an order line in the same encounter.
        const extraOrders = procedureOrders.filter((o) => {
          const v = o.queue?.visit;
          return !(v && v.doctorId === doc.id && v.treatmentId && v.treatmentId === o.treatmentId);
        }).length;

        return {
          id: doc.id,
          name: doc.name,
          email: doc.email,
          role: doc.role,
          visits: visitAgg._count._all,
          patientsSeen: distinctPatients.length,
          revenue: Number(visitAgg._sum.cashAmount ?? 0) + Number(visitAgg._sum.bankAmount ?? 0),
          consultationFees: Number(feeAgg._sum.consultationFee ?? 0),
          encounters: feeAgg._count._all,
          templates,
          procedures: procedureVisits + extraOrders,
        };
      }),
    );
  }

  /** Per nurse/staff activity: what they carried out and what it was worth. */
  async getStaffRecords(clinicId: string, from?: string, to?: string) {
    const fromDate = from || monthsAgo(12);
    const toDate = to || today();

    const staff = await this.prisma.user.findMany({
      where: { clinicId, role: { in: FLOOR_ROLES } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        assignedDoctor: { select: { id: true, name: true } },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    return Promise.all(
      staff.map(async (person) => {
        const performed = await this.prisma.careOrder.findMany({
          where: {
            clinicId,
            performedById: person.id,
            queue: { queueDate: { gte: fromDate, lte: toDate } },
          },
          select: { orderType: true, totalPrice: true, quantity: true },
        });

        const [administrations, notes] = await Promise.all([
          this.prisma.medicationAdministration.count({
            where: { clinicId, administeredById: person.id },
          }),
          this.prisma.progressNote.count({ where: { clinicId, authorId: person.id } }),
        ]);

        const medicinesGiven = performed.filter((o) => STOCK_BACKED.includes(o.orderType));

        return {
          id: person.id,
          name: person.name,
          email: person.email,
          role: normalizeRole(person.role),
          // Nurse / Staff covers both the ward and outpatients.
          scope: 'OPD & IPD',
          assignedDoctor: person.assignedDoctor?.name ?? null,
          ordersPerformed: performed.length,
          medicinesGiven: medicinesGiven.length,
          unitsGiven: medicinesGiven.reduce((a, o) => a + o.quantity, 0),
          valueGiven: performed.reduce((a, o) => a + Number(o.totalPrice), 0),
          wardAdministrations: administrations,
          progressNotes: notes,
        };
      }),
    );
  }

  /** Stock position and what the pharmacy has bought and handed out. */
  async getPharmacyRecords(clinicId: string, from?: string, to?: string) {
    const fromDate = from || monthsAgo(12);
    const toDate = to || today();

    const [medicines, purchaseTotals, purchases, dispensed, movements] = await Promise.all([
      this.prisma.medicine.findMany({
        where: { clinicId },
        orderBy: { name: 'asc' },
      }),
      // Totals must come from an aggregate — the list below is capped for display,
      // so summing it would under-report whenever there are more than `take` rows.
      this.prisma.purchase.aggregate({
        where: { clinicId, invoiceDate: { gte: fromDate, lte: toDate } },
        _sum: { totalValue: true },
        _count: { _all: true },
      }),
      this.prisma.purchase.findMany({
        where: { clinicId, invoiceDate: { gte: fromDate, lte: toDate } },
        orderBy: { invoiceDate: 'desc' },
        take: 15,
      }),
      this.prisma.careOrder.findMany({
        where: { clinicId, dispensedAt: { not: null }, queue: { queueDate: { gte: fromDate, lte: toDate } } },
        select: { totalPrice: true, quantity: true, medicineId: true },
      }),
      this.prisma.stockMovement.findMany({
        where: { clinicId },
        include: { medicine: { select: { name: true } }, performedBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const stockValue = medicines.reduce((a, m) => a + m.stockQty * Number(m.unitPrice), 0);

    return {
      period: { from: fromDate, to: toDate },
      stock: {
        itemCount: medicines.length,
        stockValue,
        lowStock: medicines
          .filter((m) => m.stockQty <= m.reorderPoint)
          .map((m) => ({ id: m.id, name: m.name, stockQty: m.stockQty, reorderPoint: m.reorderPoint, unit: m.unit })),
      },
      purchases: {
        count: purchaseTotals._count._all,
        total: Math.round(Number(purchaseTotals._sum.totalValue ?? 0) * 100) / 100,
        recent: purchases.map((p) => ({
          id: p.id,
          vendorName: p.vendorName,
          invoiceNumber: p.invoiceNumber,
          invoiceDate: p.invoiceDate,
          itemDescription: p.itemDescription,
          totalValue: Number(p.totalValue),
        })),
      },
      dispensing: {
        orderCount: dispensed.length,
        unitsDispensed: dispensed.reduce((a, d) => a + d.quantity, 0),
        valueDispensed: dispensed.reduce((a, d) => a + Number(d.totalPrice), 0),
      },
      recentMovements: movements.map((m) => ({
        id: m.id,
        medicine: m.medicine?.name,
        delta: m.delta,
        newQty: m.newQty,
        reason: m.reason,
        by: m.performedBy?.name ?? null,
        at: m.createdAt,
      })),
    };
  }

  /** What the pharmacy handed out in the period — the rows behind the "Dispensed" figure. */
  async getDispensedList(clinicId: string, from?: string, to?: string, page = '1', pageSize = '15') {
    const fromDate = from || monthsAgo(12);
    const toDate = to || today();
    const p = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 15));

    const where = {
      clinicId,
      dispensedAt: { not: null },
      queue: { queueDate: { gte: fromDate, lte: toDate } },
    };

    const [rows, total, sums] = await Promise.all([
      this.prisma.careOrder.findMany({
        where,
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          dispensedAt: true,
          medicine: { select: { name: true, unit: true } },
          patient: { select: { name: true, uhid: true } },
          dispensedBy: { select: { name: true } },
        },
        orderBy: { dispensedAt: 'desc' },
        skip: (p - 1) * size,
        take: size,
      }),
      this.prisma.careOrder.count({ where }),
      this.prisma.careOrder.aggregate({ where, _sum: { totalPrice: true, quantity: true } }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        dispensedAt: r.dispensedAt,
        item: r.medicine?.name ?? r.description,
        unit: r.medicine?.unit ?? '',
        quantity: r.quantity,
        unitPrice: Number(r.unitPrice),
        totalPrice: Number(r.totalPrice),
        patientName: r.patient?.name ?? '',
        patientUhid: r.patient?.uhid ?? '',
        dispensedBy: r.dispensedBy?.name ?? null,
      })),
      total,
      page: p,
      pageSize: size,
      summary: {
        units: sums._sum.quantity ?? 0,
        value: Number(sums._sum.totalPrice ?? 0),
        period: { from: fromDate, to: toDate },
      },
    };
  }

  async getRevenueList(clinicId: string, from?: string, to?: string, page = '1', pageSize = '15') {
    const p = parseInt(page, 10);
    const size = parseInt(pageSize, 10);

    const [allEntries, totals] = await Promise.all([
      getRevenueLedgerRows(this.prisma, clinicId, from, to),
      computeRevenue(this.prisma, clinicId, from, to),
    ]);

    allEntries.sort((a, b) => b.date.localeCompare(a.date));

    // Map to what the frontend expects
    const formattedRows = allEntries.map((e) => ({
      date: e.date,
      source: e.source.toLowerCase().replace('direct ', ''), // e.g. "visit", "package", "receipt"
      patient: e.patientName,
      method: e.paymentMethod,
      amount: e.amount,
    }));

    const totalRows = formattedRows.length;
    const paginated = formattedRows.slice((p - 1) * size, p * size);

    return {
      data: paginated,
      total: totalRows,
      page: p,
      pageSize: size,
      totalPages: Math.ceil(totalRows / size),
      summary: totals,
    };
  }
}
