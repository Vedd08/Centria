import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { exportToCsv } from '../../utils/exportToCsv';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  Pill,
  Landmark,
  Download,
  RefreshCw,
} from 'lucide-react';
import { money } from '../../utils/money';

interface Summary {
  period: { from: string; to: string };
  income: {
    collected: number;
    visitCash: number;
    visitBank: number;
    packageCash: number;
    packageBank: number;
    visitCount: number;
    packageCount: number;
  };
  receipts: { invoiceTotal: number; invoiceCash: number; invoiceBank: number; invoiceGst: number; invoiceCount: number };
  wardAndService: {
    pharmacySales: number;
    dispensedSales: number;
    pendingSales: number;
    serviceCharges: number;
    byNurseIpd: number;
    byStaffOpd: number;
    orderCount: number;
  };
  expenses: { purchaseTotal: number; purchaseTaxable: number; inputGst: number; purchaseCount: number };
  net: number;
  gst: { outputGst: number; inputGst: number; netGstPayable: number };
}

interface LedgerEntry {
  date: string;
  kind: 'INCOME' | 'EXPENSE';
  source: string;
  reference: string;
  description: string;
  amount: number;
}


const inputClass =
  'px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand';

const StatCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone?: 'brand' | 'success' | 'danger';
}> = ({ label, value, sub, icon: Icon, tone = 'brand' }) => {
  const toneMap = {
    brand: 'bg-brand-soft border-brand/20 text-brand-deep',
    success: 'bg-status-success/10 border-status-success/20 text-status-success',
    danger: 'bg-status-danger/10 border-status-danger/20 text-status-danger',
  };
  return (
    <div className="bg-surface-card p-4 rounded-[10px] border border-border shadow-xs">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${toneMap[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">{label}</p>
          <p className="text-lg font-semibold text-ink-primary leading-tight mt-0.5">{value}</p>
          {sub && <p className="text-[11px] text-ink-secondary mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
};

/** Everything money-related, pulled from every desk into one place. */
export const AccountsDashboard: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const firstOfMonth = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  };
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const qs = `from=${from}&to=${to}`;
      const [sRes, lRes] = await Promise.all([
        apiFetch(`/api/accounts/summary?${qs}`, { signal }),
        apiFetch(`/api/accounts/ledger?${qs}`, { signal }),
      ]);
      if (!sRes.ok) throw new Error('Failed to load the account summary');
      const s = await sRes.json();
      const l = await lRes.json();
      if (signal?.aborted) return;
      setSummary(s);
      setLedger(l.entries || []);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addToast('error', err.message || 'Failed to load accounts');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Landmark className="w-5 h-5 text-brand" />
            Accounts
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Every rupee the clinic takes or spends — reception payments, medicines given by the ward and service desk,
            and pharmacy stock purchases.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          <span className="text-xs text-ink-secondary">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          <button
            onClick={() => load()}
            className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading || !summary ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Collected"
              value={money(summary.income.collected)}
              sub={`${summary.income.visitCount} visits · ${summary.income.packageCount} packages`}
              icon={TrendingUp}
              tone="success"
            />
            <StatCard
              label="Expenses"
              value={money(summary.expenses.purchaseTotal)}
              sub={`${summary.expenses.purchaseCount} stock purchases`}
              icon={TrendingDown}
              tone="danger"
            />
            <StatCard
              label="Net"
              value={money(summary.net)}
              sub="Collected less purchases"
              icon={Wallet}
              tone={summary.net >= 0 ? 'success' : 'danger'}
            />
            <StatCard
              label="GST Payable"
              value={money(summary.gst.netGstPayable)}
              sub={`Output ${money(summary.gst.outputGst)} − Input ${money(summary.gst.inputGst)}`}
              icon={Landmark}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-surface-card p-4 rounded-[10px] border border-border shadow-xs space-y-2.5">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand" /> Money In
              </h3>
              {[
                ['Visit cash', summary.income.visitCash],
                ['Visit bank', summary.income.visitBank],
                ['Package cash', summary.income.packageCash],
                ['Package bank', summary.income.packageBank],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between text-xs">
                  <span className="text-ink-secondary">{label}</span>
                  <span className="font-mono">{money(val as number)}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-semibold border-t border-border pt-2">
                <span>Total collected</span>
                <span className="font-mono text-status-success">{money(summary.income.collected)}</span>
              </div>
            </div>

            <div className="bg-surface-card p-4 rounded-[10px] border border-border shadow-xs space-y-2.5">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Pill className="w-4 h-4 text-brand" /> Ward &amp; Service Desk
              </h3>
              {[
                ['Given by nurse (IPD)', summary.wardAndService.byNurseIpd],
                ['Given by staff (OPD)', summary.wardAndService.byStaffOpd],
                ['Medicines dispensed', summary.wardAndService.dispensedSales],
                ['Awaiting dispense', summary.wardAndService.pendingSales],
                ['Service charges', summary.wardAndService.serviceCharges],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between text-xs">
                  <span className="text-ink-secondary">{label}</span>
                  <span className="font-mono">{money(val as number)}</span>
                </div>
              ))}
              <p className="text-[10px] text-ink-secondary/70 border-t border-border pt-2">
                {summary.wardAndService.orderCount} care order(s) in this period.
              </p>
            </div>

            <div className="bg-surface-card p-4 rounded-[10px] border border-border shadow-xs space-y-2.5">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand" /> Reception Receipts
              </h3>
              {[
                ['Invoiced total', summary.receipts.invoiceTotal],
                ['Cash', summary.receipts.invoiceCash],
                ['Bank', summary.receipts.invoiceBank],
                ['GST charged', summary.receipts.invoiceGst],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between text-xs">
                  <span className="text-ink-secondary">{label}</span>
                  <span className="font-mono">{money(val as number)}</span>
                </div>
              ))}
              <p className="text-[10px] text-ink-secondary/70 border-t border-border pt-2">
                {summary.receipts.invoiceCount} printed receipt(s).
              </p>
            </div>
          </div>

          <div className="bg-surface-card rounded-[10px] border border-border shadow-xs overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-semibold">Ledger</h3>
              <button
                onClick={() =>
                  exportToCsv('accounts-ledger', ledger, [
                    { key: 'date', label: 'Date' },
                    { key: 'kind', label: 'Type' },
                    { key: 'source', label: 'Source' },
                    { key: 'reference', label: 'Reference' },
                    { key: 'description', label: 'Description' },
                    { key: 'amount', label: 'Amount' },
                  ])
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>

            {ledger.length === 0 ? (
              <p className="p-8 text-center text-xs text-ink-secondary">No money movements in this period.</p>
            ) : (
              <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-surface-page">
                    <tr className="border-b border-border text-ink-secondary font-medium">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Source</th>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {ledger.map((e, i) => (
                      <tr key={i} className="hover:bg-surface-page/60">
                        <td className="py-2.5 px-4 font-mono text-ink-secondary whitespace-nowrap">{e.date}</td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                              e.kind === 'INCOME'
                                ? 'bg-status-success/10 text-status-success border-status-success/20'
                                : 'bg-status-danger/10 text-status-danger border-status-danger/20'
                            }`}
                          >
                            {e.kind === 'INCOME' ? 'In' : 'Out'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-ink-secondary whitespace-nowrap">{e.source}</td>
                        <td className="py-2.5 px-4 max-w-[280px] truncate" title={e.description}>
                          {e.description}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono font-medium ${
                            e.kind === 'INCOME' ? 'text-status-success' : 'text-status-danger'
                          }`}
                        >
                          {e.kind === 'INCOME' ? '+' : '−'}
                          {money(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
