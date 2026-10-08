import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Care order types that consume pharmacy stock and therefore carry a sale value. */
const STOCK_BACKED = ['MEDICINE', 'INJECTION'];

const monthsAgo = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split('T')[0];
};
const today = () => new Date().toISOString().split('T')[0];

/**
 * The clinic's single financial picture. Every desk records money in its own place —
 * reception takes payments, the ward and service desk give out medicines, the pharmacy
 * buys stock — and this pulls all of it together so accounts never has to chase it.
 */
@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(clinicId: string, from?: string, to?: string) {
    const fromDate = from || monthsAgo(1);
    const toDate = to || today();

    const [invoices, visitTotals, packageTotals, careOrders, purchases] = await Promise.all([
      // Reception receipts — the formal GST invoices.
      this.prisma.invoice.findMany({
        where: { clinicId, issuedAt: { gte: new Date(`${fromDate}T00:00:00`), lte: new Date(`${toDate}T23:59:59`) } },
        select: { totalAmount: true, taxableValue: true, cgst: true, sgst: true, paymentMethod: true },
      }),
      // Money captured directly on the day-book rows (how the clinic has always worked).
      this.prisma.visit.aggregate({
        where: { clinicId, date: { gte: fromDate, lte: toDate } },
        _sum: { cashAmount: true, bankAmount: true },
        _count: { _all: true },
      }),
      this.prisma.packagePurchase.aggregate({
        where: { clinicId, purchaseDate: { gte: fromDate, lte: toDate } },
        _sum: { cashAmount: true, bankAmount: true },
        _count: { _all: true },
      }),
      // What the ward/service desk actually handed to patients.
      this.prisma.careOrder.findMany({
        where: {
          clinicId,
          status: { not: 'CANCELLED' },
          queue: { queueDate: { gte: fromDate, lte: toDate } },
        },
        select: { orderType: true, totalPrice: true, dispensedAt: true, queue: { select: { careType: true } } },
      }),
      // Stock and running costs bought in.
      this.prisma.purchase.aggregate({
        where: { clinicId, invoiceDate: { gte: fromDate, lte: toDate } },
        _sum: { totalValue: true, taxableValue: true, igst: true, cgst: true, sgst: true },
        _count: { _all: true },
      }),
    ]);

    const sum = (rows: { totalAmount: any }[]) => rows.reduce((a, r) => a + Number(r.totalAmount), 0);
    const invoiceTotal = sum(invoices);
    const invoiceCash = sum(invoices.filter((i) => i.paymentMethod === 'cash'));
    const invoiceBank = invoiceTotal - invoiceCash;
    const invoiceGst = invoices.reduce((a, r) => a + Number(r.cgst) + Number(r.sgst), 0);

    const visitCash = Number(visitTotals._sum.cashAmount ?? 0);
    const visitBank = Number(visitTotals._sum.bankAmount ?? 0);
    const packageCash = Number(packageTotals._sum.cashAmount ?? 0);
    const packageBank = Number(packageTotals._sum.bankAmount ?? 0);

    const pharmacyOrders = careOrders.filter((o) => STOCK_BACKED.includes(o.orderType));
    const pharmacySales = pharmacyOrders.reduce((a, o) => a + Number(o.totalPrice), 0);
    const dispensedSales = pharmacyOrders
      .filter((o) => o.dispensedAt)
      .reduce((a, o) => a + Number(o.totalPrice), 0);
    const serviceCharges = careOrders
      .filter((o) => !STOCK_BACKED.includes(o.orderType))
      .reduce((a, o) => a + Number(o.totalPrice), 0);

    const byNurse = careOrders
      .filter((o) => o.queue?.careType === 'IPD')
      .reduce((a, o) => a + Number(o.totalPrice), 0);
    const byStaff = careOrders
      .filter((o) => o.queue?.careType === 'OPD')
      .reduce((a, o) => a + Number(o.totalPrice), 0);

    const purchaseTotal = Number(purchases._sum.totalValue ?? 0);
    const inputGst =
      Number(purchases._sum.igst ?? 0) + Number(purchases._sum.cgst ?? 0) + Number(purchases._sum.sgst ?? 0);

    // Day-book takings are the settled record of money received; invoices and care
    // orders are shown alongside so accounts can see what each desk generated.
    const collected = visitCash + visitBank + packageCash + packageBank;

    return {
      period: { from: fromDate, to: toDate },
      income: {
        collected,
        visitCash,
        visitBank,
        packageCash,
        packageBank,
        visitCount: visitTotals._count._all,
        packageCount: packageTotals._count._all,
      },
      receipts: {
        invoiceTotal,
        invoiceCash,
        invoiceBank,
        invoiceGst,
        invoiceCount: invoices.length,
      },
      wardAndService: {
        pharmacySales,
        dispensedSales,
        pendingSales: pharmacySales - dispensedSales,
        serviceCharges,
        byNurseIpd: byNurse,
        byStaffOpd: byStaff,
        orderCount: careOrders.length,
      },
      expenses: {
        purchaseTotal,
        purchaseTaxable: Number(purchases._sum.taxableValue ?? 0),
        inputGst,
        purchaseCount: purchases._count._all,
      },
      net: collected - purchaseTotal,
      gst: { outputGst: invoiceGst, inputGst, netGstPayable: invoiceGst - inputGst },
    };
  }

  /** A single chronological money ledger, so accounts can audit line by line. */
  async getLedger(clinicId: string, from?: string, to?: string) {
    const fromDate = from || monthsAgo(1);
    const toDate = to || today();

    const [invoices, purchases, careOrders] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { clinicId, issuedAt: { gte: new Date(`${fromDate}T00:00:00`), lte: new Date(`${toDate}T23:59:59`) } },
        orderBy: { issuedAt: 'desc' },
        take: 100,
      }),
      this.prisma.purchase.findMany({
        where: { clinicId, invoiceDate: { gte: fromDate, lte: toDate } },
        orderBy: { invoiceDate: 'desc' },
        take: 100,
      }),
      this.prisma.careOrder.findMany({
        where: {
          clinicId,
          status: { not: 'CANCELLED' },
          queue: { queueDate: { gte: fromDate, lte: toDate } },
        },
        include: {
          patient: { select: { name: true } },
          queue: { select: { queueDate: true, careType: true } },
          performedBy: { select: { name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const entries = [
      ...invoices.map((i) => ({
        date: i.issuedAt.toISOString().split('T')[0],
        kind: 'INCOME' as const,
        source: 'Reception receipt',
        reference: i.invoiceNumber,
        description: `${i.patientName} — ${i.itemTitle}`,
        amount: Number(i.totalAmount),
      })),
      ...careOrders.map((o) => ({
        date: o.queue?.queueDate ?? o.createdAt.toISOString().split('T')[0],
        kind: 'INCOME' as const,
        source:
          o.queue?.careType === 'IPD' ? 'Ward (nurse)' : o.queue?.careType === 'OPD' ? 'Service desk (staff)' : 'Care order',
        reference: o.orderType,
        description: `${o.patient?.name ?? 'Patient'} — ${o.description} x${o.quantity}${
          o.performedBy ? ` (given by ${o.performedBy.name})` : ''
        }`,
        amount: Number(o.totalPrice),
      })),
      ...purchases.map((p) => ({
        date: p.invoiceDate,
        kind: 'EXPENSE' as const,
        source: 'Pharmacy / stock purchase',
        reference: p.invoiceNumber,
        description: `${p.vendorName} — ${p.itemDescription}`,
        amount: Number(p.totalValue),
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return { period: { from: fromDate, to: toDate }, entries };
  }
}
