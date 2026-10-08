import { toLocalDateKey } from './date.helper';
import { PrismaClient } from '@prisma/client';

export interface RevenueBreakdown {
  invoices: number;
  visitDirect: number;
  packages: number;
  total: number;
  cash: number;
  bank: number;
  invoiceCash: number;
  invoiceBank: number;
  visitCash: number;
  visitBank: number;
  packageCash: number;
  packageBank: number;
  invoiceCount: number;
  visitCount: number;
  packageCount: number;
}

export async function computeRevenue(
  prisma: any,
  clinicId: string,
  from?: string,
  to?: string
): Promise<RevenueBreakdown> {
  // If dates are provided, we filter. If not, we don't (for lifetime revenue).
  const invoiceWhere = { clinicId, ...(from && to ? { issuedAt: { gte: new Date(`${from}T00:00:00`), lte: new Date(`${to}T23:59:59`) } } : {}) };
  const visitWhere = { clinicId, invoices: { none: {} }, ...(from && to ? { date: { gte: from, lte: to } } : {}) };
  const packageWhere = { clinicId, invoices: { none: {} }, ...(from && to ? { purchaseDate: { gte: from, lte: to } } : {}) };

  const [invoicesAgg, invoicesList, visitsAgg, packagesAgg, nonZeroVisitsCount, nonZeroPackagesCount] = await Promise.all([
    prisma.invoice.aggregate({
      where: invoiceWhere,
      _sum: { totalAmount: true },
      _count: { _all: true }
    }),
    prisma.invoice.findMany({
      where: invoiceWhere,
      select: { paymentMethod: true, totalAmount: true },
    }),
    prisma.visit.aggregate({
      where: visitWhere,
      _sum: { cashAmount: true, bankAmount: true },
    }),
    prisma.packagePurchase.aggregate({
      where: packageWhere,
      _sum: { cashAmount: true, bankAmount: true },
    }),
    prisma.visit.count({
      where: { ...visitWhere, OR: [{ cashAmount: { gt: 0 } }, { bankAmount: { gt: 0 } }] }
    }),
    prisma.packagePurchase.count({
      where: { ...packageWhere, OR: [{ cashAmount: { gt: 0 } }, { bankAmount: { gt: 0 } }] }
    }),
  ]);

  const invoiceTotal = Number(invoicesAgg._sum.totalAmount ?? 0);
  const invoiceCash = invoicesList.filter((i: any) => i.paymentMethod === 'cash').reduce((a: number, b: any) => a + Number(b.totalAmount), 0);
  const invoiceBank = invoiceTotal - invoiceCash;

  const visitCash = Number(visitsAgg._sum.cashAmount ?? 0);
  const visitBank = Number(visitsAgg._sum.bankAmount ?? 0);
  const visitDirect = visitCash + visitBank;

  const pkgCash = Number(packagesAgg._sum.cashAmount ?? 0);
  const pkgBank = Number(packagesAgg._sum.bankAmount ?? 0);
  const pkgTotal = pkgCash + pkgBank;

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    invoices: round2(invoiceTotal),
    visitDirect: round2(visitDirect),
    packages: round2(pkgTotal),
    total: round2(invoiceTotal + visitDirect + pkgTotal),
    cash: round2(invoiceCash + visitCash + pkgCash),
    bank: round2(invoiceBank + visitBank + pkgBank),
    invoiceCash: round2(invoiceCash),
    invoiceBank: round2(invoiceBank),
    visitCash: round2(visitCash),
    visitBank: round2(visitBank),
    packageCash: round2(pkgCash),
    packageBank: round2(pkgBank),
    invoiceCount: invoicesAgg._count._all,
    visitCount: nonZeroVisitsCount,
    packageCount: nonZeroPackagesCount,
  };
}

export async function getRevenueLedgerRows(
  prisma: any,
  clinicId: string,
  from?: string,
  to?: string
) {
  // Lifetime or filtered
  const invoiceWhere = { clinicId, ...(from && to ? { issuedAt: { gte: new Date(`${from}T00:00:00`), lte: new Date(`${to}T23:59:59`) } } : {}) };
  const visitWhere = { clinicId, invoices: { none: {} }, ...(from && to ? { date: { gte: from, lte: to } } : {}) };
  const packageWhere = { clinicId, invoices: { none: {} }, ...(from && to ? { purchaseDate: { gte: from, lte: to } } : {}) };

  const [invoices, directVisits, directPackages] = await Promise.all([
    prisma.invoice.findMany({
      where: invoiceWhere,
      select: { issuedAt: true, invoiceNumber: true, patientName: true, itemTitle: true, paymentMethod: true, totalAmount: true },
    }),
    prisma.visit.findMany({
      where: visitWhere,
      select: { id: true, date: true, patient: { select: { name: true } }, treatmentName: true, cashAmount: true, bankAmount: true },
    }),
    prisma.packagePurchase.findMany({
      where: packageWhere,
      select: { id: true, purchaseDate: true, patient: { select: { name: true } }, packageName: true, cashAmount: true, bankAmount: true },
    }),
  ]);

  const rows: { date: string; source: string; patientName: string; itemTitle: string; amount: number; paymentMethod: string; reference?: string }[] = [];

  for (const i of invoices) {
    rows.push({
      date: toLocalDateKey(i.issuedAt), // we'll fix toISOString here later, or just do it now: toLocalDateKey
      source: 'Receipt',
      patientName: i.patientName,
      itemTitle: i.itemTitle,
      amount: Number(i.totalAmount),
      paymentMethod: i.paymentMethod,
      reference: i.invoiceNumber,
    });
  }

  for (const v of directVisits) {
    const reference = `${v.treatmentName} (Visit ${v.id})`;
    if (v.cashAmount > 0) {
      rows.push({ date: v.date, source: 'Direct Visit', patientName: v.patient.name, itemTitle: v.treatmentName, amount: Number(v.cashAmount), paymentMethod: 'cash', reference });
    }
    if (v.bankAmount > 0) {
      rows.push({ date: v.date, source: 'Direct Visit', patientName: v.patient.name, itemTitle: v.treatmentName, amount: Number(v.bankAmount), paymentMethod: 'bank', reference });
    }
  }

  for (const p of directPackages) {
    const reference = `${p.packageName} (Pkg ${p.id})`;
    if (p.cashAmount > 0) {
      rows.push({ date: p.purchaseDate, source: 'Direct Package', patientName: p.patient.name, itemTitle: p.packageName, amount: Number(p.cashAmount), paymentMethod: 'cash', reference });
    }
    if (p.bankAmount > 0) {
      rows.push({ date: p.purchaseDate, source: 'Direct Package', patientName: p.patient.name, itemTitle: p.packageName, amount: Number(p.bankAmount), paymentMethod: 'bank', reference });
    }
  }

  return rows;
}
