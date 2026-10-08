import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeRevenue, getRevenueLedgerRows } from '../common/revenue';
import { toLocalDateKey } from '../common/date.helper';

/** Care order types that consume pharmacy stock and therefore carry a sale value. */
const STOCK_BACKED = ['MEDICINE', 'INJECTION'];

const monthsAgo = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return toLocalDateKey(d);
};
const today = () => toLocalDateKey(new Date());

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

    const [invoices, purchases, rev, raisedOrders, performedOrders] = await Promise.all([
      // Reception receipts — the formal GST invoices.
      this.prisma.invoice.findMany({
        where: { clinicId, issuedAt: { gte: new Date(`${fromDate}T00:00:00`), lte: new Date(`${toDate}T23:59:59`) } },
        select: { totalAmount: true, taxableValue: true, cgst: true, sgst: true, paymentMethod: true },
      }),
      // Stock and running costs bought in.
      this.prisma.purchase.aggregate({
        where: { clinicId, invoiceDate: { gte: fromDate, lte: toDate } },
        _sum: { totalValue: true, taxableValue: true, igst: true, cgst: true, sgst: true },
        _count: { _all: true },
      }),
      computeRevenue(this.prisma, clinicId, fromDate, toDate),
      // Orders raised in this period (for footer counts)
      this.prisma.careOrder.count({
        where: {
          clinicId,
          status: { not: 'CANCELLED' },
          queue: { queueDate: { gte: fromDate, lte: toDate } },
        },
      }),
      // Orders performed in this period (for financial rows)
      this.prisma.careOrder.findMany({
        where: {
          clinicId,
          status: 'DONE',
          performedAt: { gte: new Date(`${fromDate}T00:00:00`), lte: new Date(`${toDate}T23:59:59`) },
        },
        select: { totalPrice: true, performedBy: { select: { role: true } } },
      }),
    ]);

    const sum = (rows: { totalAmount: any }[]) => rows.reduce((a, r) => a + Number(r.totalAmount), 0);
    const invoiceTotal = sum(invoices);
    const invoiceCash = sum(invoices.filter((i) => i.paymentMethod === 'cash'));
    const invoiceBank = invoiceTotal - invoiceCash;
    const invoiceGst = invoices.reduce((a, r) => a + Number(r.cgst) + Number(r.sgst), 0);

    const visitCash = rev.visitCash;
    const visitBank = rev.visitBank;
    const packageCash = rev.packageCash;
    const packageBank = rev.packageBank;

    const byNurse = performedOrders
      .filter((o) => o.performedBy?.role === 'NURSE')
      .reduce((a, o) => a + Number(o.totalPrice), 0);
    const byStaff = performedOrders
      .filter((o) => o.performedBy?.role === 'STAFF')
      .reduce((a, o) => a + Number(o.totalPrice), 0);
    const byDoctorsCount = performedOrders.filter((o) => o.performedBy?.role === 'DOCTOR' || o.performedBy?.role === 'MASTER').length;

    const purchaseTotal = Math.round(Number(purchases._sum.totalValue ?? 0) * 100) / 100;
    const inputGst =
      Number(purchases._sum.igst ?? 0) + Number(purchases._sum.cgst ?? 0) + Number(purchases._sum.sgst ?? 0);

    // Day-book takings are the settled record of money received; invoices and care
    // orders are shown alongside so accounts can see what each desk generated.
    const collected = rev.total; // Uses the properly de-duplicated revenue total

    return {
      period: { from: fromDate, to: toDate },
      income: {
        collected,
        visitCash,
        visitBank,
        packageCash,
        packageBank,
        invoiceCash: rev.invoiceCash,
        invoiceBank: rev.invoiceBank,
        visitCount: rev.visitCount,
        packageCount: rev.packageCount,
      },
      receipts: {
        invoiceTotal,
        invoiceCash,
        invoiceBank,
        invoiceGst,
        invoiceCount: invoices.length,
      },
      wardAndService: {
        byNurse,
        byStaff,
        raisedOrderCount: raisedOrders,
        performedOrderCount: performedOrders.length,
        performedByDoctorsCount: byDoctorsCount,
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
  async getLedger(clinicId: string, page: number = 1, pageSize: number = 20, from?: string, to?: string) {
    const fromDate = from || monthsAgo(1);
    const toDate = to || today();

    const [revenueRows, purchases] = await Promise.all([
      getRevenueLedgerRows(this.prisma, clinicId, fromDate, toDate),
      this.prisma.purchase.findMany({
        where: { clinicId, invoiceDate: { gte: fromDate, lte: toDate } },
        orderBy: { invoiceDate: 'desc' },
      }),
    ]);

    const allEntries = [
      ...revenueRows.map((r) => ({
        date: r.date,
        kind: 'INCOME' as const,
        source: r.source,
        reference: r.reference || '-',
        description: `${r.patientName} — ${r.itemTitle}`,
        amount: r.amount,
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

    const total = allEntries.length;
    const entries = allEntries.slice((page - 1) * pageSize, page * pageSize);

    return { 
      period: { from: fromDate, to: toDate }, 
      entries,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }
}
