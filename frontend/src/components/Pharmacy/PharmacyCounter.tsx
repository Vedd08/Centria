import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { StatusBadge } from '../common/StatusBadge';
import { MedicineList } from '../Medicines/MedicineList';
import { CareOrder, ORDER_TYPE_LABEL, money } from '../Queue/types';
import { Package, RefreshCw, Pill, AlertTriangle, Boxes, Receipt, FileText, CheckCircle2 } from 'lucide-react';
import { PrintableInvoiceModal, InvoiceItem } from '../Invoices/PrintableInvoiceModal';
import { PrintablePatientBill, PatientBill } from '../Reception/PrintablePatientBill';
import { PAYMENT_MODE_LABEL, PaymentMode } from '../common/payment/paymentModes';
import { RetailPOS } from './RetailPOS';
import { StockRefill } from './StockRefill';
import { ExpiryDashboard } from './ExpiryDashboard';

const todayStr = () => new Date().toISOString().split('T')[0];

type Tab = 'counter' | 'stock' | 'retail' | 'refill' | 'expiries';
type Filter = 'dispense' | 'collect' | 'done' | 'all';

const STOCK_BACKED = ['MEDICINE', 'INJECTION'];

interface QueueBill {
  kind: 'PATIENT' | 'PHARMACY';
  billNumber: string;
  paymentStatus: 'PAID' | 'UNPAID';
  paymentMode?: PaymentMode | null;
  paidAmount?: number | string | null;
}

interface PatientGroup {
  key: string;
  queueId?: string;
  patientName: string;
  patientPhone: string;
  token?: number;
  careType?: string;
  orders: CareOrder[];
  /** Value of what has been handed over — what the pharmacy bill charges. */
  dispensedValue: number;
  pending: number;
  bill?: QueueBill;
}

/** Undispensed items that can actually be handed over now (enough stock). */
const dispensableCount = (g: PatientGroup) =>
  g.orders.filter((o) => !o.dispensedAt && (o.medicine?.stockQty ?? 0) >= o.quantity).length;

/**
 * Where a patient stands at the counter. An item that can't be dispensed (out of
 * stock) doesn't hold the patient back from paying for what they've received.
 */
const stageOf = (g: PatientGroup): Filter => {
  if (dispensableCount(g) > 0) return 'dispense';
  // Inpatients' medicines are billed on the ward/patient bill, not here.
  if (g.careType === 'OPD' && g.dispensedValue > 0 && g.bill?.paymentStatus !== 'PAID') return 'collect';
  if (g.pending > 0 && g.dispensedValue === 0) return 'dispense'; // waiting on stock, nothing given yet
  return 'done';
};

/**
 * The pharmacy desk. Everything a doctor ordered that draws on stock lands here,
 * grouped per patient. Patients stay on the counter after dispensing until their
 * pharmacy bill is paid, so the pharmacist can collect and print the bill.
 */
export const PharmacyCounter: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>('counter');
  const [filter, setFilter] = useState<Filter>('all');
  const [orders, setOrders] = useState<CareOrder[]>([]);
  const [bills, setBills] = useState<Record<string, QueueBill | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [printingInvoice, setPrintingInvoice] = useState<InvoiceItem | null>(null);
  const [pharmacyBill, setPharmacyBill] = useState<PatientBill | null>(null);
  const [loadingBillFor, setLoadingBillFor] = useState<string | null>(null);

  const fetchOrders = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      // The whole day's medicine orders — dispensed ones included — plus each
      // encounter's pharmacy bill status from the queue.
      const [oRes, qRes] = await Promise.all([
        apiFetch(`/api/care-orders?${new URLSearchParams({ date })}`, { signal }),
        apiFetch(`/api/queue?${new URLSearchParams({ date })}`, { signal }),
      ]);
      if (!oRes.ok) {
        const err = await oRes.json().catch(() => ({ message: 'Failed to load pharmacy queue' }));
        throw new Error(err.message || 'Failed to load pharmacy queue');
      }
      const data = await oRes.json();
      const queue = qRes.ok ? await qRes.json() : [];
      if (signal?.aborted) return;
      const rows: CareOrder[] = Array.isArray(data) ? data : data.data || [];
      setOrders(rows.filter((o) => STOCK_BACKED.includes(o.orderType) && o.medicine && o.status !== 'CANCELLED'));
      const map: Record<string, QueueBill | undefined> = {};
      for (const q of Array.isArray(queue) ? queue : queue.data || []) {
        map[q.id] = (q.bills || []).find((b: QueueBill) => b.kind === 'PHARMACY');
      }
      setBills(map);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addToast('error', err.message || 'Failed to load pharmacy queue');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== 'counter') return;
    const controller = new AbortController();
    fetchOrders(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, tab]);

  const openPharmacyBill = async (queueId: string) => {
    setLoadingBillFor(queueId);
    try {
      const res = await apiFetch(`/api/queue/${queueId}/pharmacy-bill`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not build the pharmacy bill');
      setPharmacyBill(data);
    } catch (err: any) {
      addToast('error', err.message || 'Could not build the pharmacy bill');
    } finally {
      setLoadingBillFor(null);
    }
  };

  const dispense = async (order: CareOrder) => {
    setBusyId(order.id);
    try {
      const res = await apiFetch(`/api/care-orders/${order.id}/dispense`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to dispense');
      addToast('success', `${order.description} dispensed — stock updated`);
      fetchOrders();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to dispense');
    } finally {
      setBusyId(null);
    }
  };

  // Group by patient so the counter serves one person at a time.
  const groups: PatientGroup[] = useMemo(() => {
    const acc: Record<string, PatientGroup> = {};
    for (const o of orders) {
      const key = o.queue?.id || o.patient?.id || o.id;
      acc[key] ||= {
        key,
        queueId: o.queue?.id,
        patientName: o.patient?.name || 'Unknown',
        patientPhone: o.patient?.phone || '',
        token: o.queue?.tokenNumber,
        careType: o.queue?.careType,
        orders: [],
        dispensedValue: 0,
        pending: 0,
        bill: o.queue?.id ? bills[o.queue.id] : undefined,
      };
      acc[key].orders.push(o);
      if (o.dispensedAt) acc[key].dispensedValue += Number(o.totalPrice);
      else acc[key].pending += 1;
    }
    // Show what the pharmacy bill will charge: dispensed items plus their GST, worked
    // out the way the bill does (half-rate CGST + SGST, each rounded to paise).
    const r2 = (n: number) => Math.round(n * 100) / 100;
    for (const g of Object.values(acc)) {
      let sub = 0, halfTax = 0;
      for (const o of g.orders) {
        if (!o.dispensedAt) continue;
        const amount = Number(o.totalPrice);
        sub += amount;
        const med = o.medicine as { isGstTaxable?: boolean; taxRate?: number | string } | undefined;
        if (med?.isGstTaxable) halfTax += (amount * Number(med.taxRate ?? 18)) / 200;
      }
      g.dispensedValue = r2(r2(sub) + 2 * r2(halfTax));
    }
    return Object.values(acc).sort((a, b) => (a.token ?? 0) - (b.token ?? 0));
  }, [orders, bills]);

  const counts = useMemo(() => {
    const c = { dispense: 0, collect: 0, done: 0, all: groups.length };
    for (const g of groups) c[stageOf(g)]++;
    return c;
  }, [groups]);

  const shown = filter === 'all' ? groups : groups.filter((g) => stageOf(g) === filter);
  const itemsToDispense = orders.filter((o) => !o.dispensedAt).length;
  const toCollect = groups.filter((g) => stageOf(g) === 'collect').reduce((s, g) => s + g.dispensedValue, 0);
  const collected = groups.reduce((s, g) => s + (g.bill?.paymentStatus === 'PAID' ? Number(g.bill.paidAmount ?? 0) : 0), 0);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'dispense', label: 'To dispense' },
    { key: 'collect', label: 'To collect' },
    { key: 'done', label: 'Completed' },
    { key: 'all', label: 'All today' },
  ];

  return (
    <div className="space-y-5 font-sans text-ink-primary">
      <div className="flex items-center gap-1 bg-surface-card px-2 rounded-[10px] border border-border shadow-xs">
        {[
          { key: 'counter' as Tab, label: 'Dispensing Counter', icon: Package },
          { key: 'stock' as Tab, label: 'Stock & Medicines', icon: Boxes },
          { key: 'retail' as Tab, label: 'Retail POS', icon: Receipt },
          { key: 'refill' as Tab, label: 'Stock Refill', icon: Package },
          { key: 'expiries' as Tab, label: 'Expiries', icon: AlertTriangle },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 cursor-pointer transition-colors ${
                tab === t.key ? 'border-brand text-brand-deep' : 'border-transparent text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'stock' ? (
        <MedicineList />
      ) : tab === 'retail' ? (
        <RetailPOS onInvoiceGenerated={setPrintingInvoice} />
      ) : tab === 'refill' ? (
        <StockRefill />
      ) : tab === 'expiries' ? (
        <ExpiryDashboard />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
            <div>
              <h2 className="text-lg font-semibold text-ink-primary tracking-tight flex items-center gap-2">
                <Pill className="w-5 h-5 text-brand" />
                Pharmacy Counter
              </h2>
              <p className="text-xs text-ink-secondary mt-0.5 hidden sm:block">
                Dispense what doctors ordered, then collect and print the pharmacy bill. Patients stay here until their bill is paid.
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
              />
              <button
                onClick={() => fetchOrders()}
                disabled={loading}
                className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border transition-colors cursor-pointer shrink-0"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {!loading && groups.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-surface-card rounded-[10px] border border-border p-3.5 shadow-xs">
                <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Patients today</p>
                <p className="text-xl font-semibold text-ink-primary mt-0.5">{groups.length}</p>
              </div>
              <div className="bg-surface-card rounded-[10px] border border-border p-3.5 shadow-xs">
                <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Items to dispense</p>
                <p className="text-xl font-semibold text-ink-primary mt-0.5">{itemsToDispense}</p>
              </div>
              <div className="bg-brand-soft/60 rounded-[10px] border border-brand/20 p-3.5 shadow-xs">
                <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">To collect</p>
                <p className="text-xl font-semibold text-brand-deep mt-0.5">{money(toCollect)}</p>
              </div>
              <div className="bg-surface-card rounded-[10px] border border-border p-3.5 shadow-xs">
                <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Collected</p>
                <p className="text-xl font-semibold text-status-success mt-0.5">{money(collected)}</p>
              </div>
            </div>
          )}

          {!loading && groups.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer ${
                    filter === f.key ? 'bg-brand text-white border-brand' : 'bg-surface-card text-ink-secondary border-border hover:text-ink-primary'
                  }`}
                >
                  {f.label} ({counts[f.key]})
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : shown.length === 0 ? (
            <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2">
              <p className="text-sm font-semibold text-ink-primary">
                {groups.length === 0 ? 'No medicine orders for this day' : 'Nobody in this list'}
              </p>
              <p className="text-xs text-ink-secondary">
                Medicine and injection orders appear here as soon as a doctor raises them.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {shown.map((g) => {
                const stage = stageOf(g);
                const paid = g.bill?.paymentStatus === 'PAID';
                return (
                  <div key={g.key} className="bg-surface-card rounded-[10px] border border-border shadow-xs overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border bg-surface-page/50">
                      <div className="flex items-center gap-2.5">
                        {g.token != null && (
                          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded bg-brand-soft border border-brand/20 text-brand-deep font-mono font-semibold text-xs">
                            {g.token}
                          </span>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-ink-primary">{g.patientName}</p>
                          <p className="text-[11px] text-ink-secondary font-mono">{g.patientPhone}</p>
                        </div>
                        {g.careType && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-card border border-border text-ink-secondary">
                            {g.careType}
                          </span>
                        )}
                        <StatusBadge
                          label={stage === 'dispense' ? `${g.pending} to dispense` : stage === 'collect' ? 'Payment due' : 'Completed'}
                          variant={stage === 'dispense' ? 'warning' : stage === 'collect' ? 'danger' : 'success'}
                        />
                        {stage !== 'dispense' && g.pending > 0 && (
                          <StatusBadge label={`${g.pending} not dispensed (stock)`} variant="warning" />
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {/* OPD patients pay the pharmacist; inpatients' medicines go on the patient bill. */}
                        {g.queueId && g.careType === 'OPD' ? (
                          <button
                            onClick={() => openPharmacyBill(g.queueId!)}
                            disabled={loadingBillFor === g.queueId}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md cursor-pointer disabled:opacity-50 ${
                              stage === 'collect'
                                ? 'text-white bg-brand hover:bg-brand-deep shadow-xs'
                                : 'text-ink-primary bg-surface-card hover:bg-surface-page border border-border'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {loadingBillFor === g.queueId ? 'Loading...' : stage === 'collect' ? 'Collect payment' : 'Pharmacy Bill'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-ink-secondary">Billed on the patient bill (IPD)</span>
                        )}
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">
                            {g.careType === 'OPD' ? (paid ? 'Paid' : 'Bill') : 'Dispensed'}
                          </p>
                          <p className={`text-sm font-semibold ${paid ? 'text-status-success' : 'text-brand-deep'}`}>
                            {money(paid ? g.bill?.paidAmount : g.dispensedValue)}
                          </p>
                          {paid && g.bill?.paymentMode && (
                            <p className="text-[10px] text-ink-secondary">
                              {PAYMENT_MODE_LABEL[g.bill.paymentMode]} · {g.bill.billNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      {g.orders.map((o) => {
                        const stock = o.medicine?.stockQty ?? 0;
                        const done = !!o.dispensedAt;
                        const short = !done && stock < o.quantity;
                        return (
                          <div
                            key={o.id}
                            className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border ${
                              done ? 'bg-status-success/5 border-status-success/20' : 'bg-surface-page border-border'
                            }`}
                          >
                            <div className="min-w-[180px]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-ink-primary">{o.description}</span>
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-card border border-border text-ink-secondary">
                                  {ORDER_TYPE_LABEL[o.orderType] || o.orderType}
                                </span>
                              </div>
                              <p className="text-[11px] text-ink-secondary mt-0.5">
                                Qty {o.quantity} × {money(o.unitPrice)} = {money(o.totalPrice)}
                                {o.medicine && !done && ` · ${stock} ${o.medicine.unit} in stock`}
                                {[o.dosage, o.frequency].filter(Boolean).length > 0 && ` · ${[o.dosage, o.frequency].filter(Boolean).join(', ')}`}
                              </p>
                              {short && (
                                <p className="text-[11px] text-status-danger flex items-center gap-1 mt-0.5">
                                  <AlertTriangle className="w-3 h-3" /> Only {stock} in stock, {o.quantity} prescribed — refill stock or ask the doctor to change the quantity
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {done ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-status-success">
                                  <CheckCircle2 className="w-4 h-4" />
                                  Dispensed{' '}
                                  {new Date(o.dispensedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              ) : (
                                <>
                                  <StatusBadge label="Ordered" variant="warning" />
                                  <button
                                    onClick={() => dispense(o)}
                                    disabled={busyId === o.id || short}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={short ? 'Insufficient stock to dispense' : 'Dispense and deduct stock'}
                                  >
                                    <Package className="w-3.5 h-3.5" />
                                    {busyId === o.id ? 'Dispensing...' : 'Dispense'}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {printingInvoice && (
        <PrintableInvoiceModal
          invoice={printingInvoice}
          onClose={() => setPrintingInvoice(null)}
        />
      )}
      <PrintablePatientBill
        bill={pharmacyBill}
        onClose={() => setPharmacyBill(null)}
        onChange={(b) => {
          setPharmacyBill(b);
          fetchOrders(); // Paid/unpaid status on the cards follows the bill.
        }}
      />
    </div>
  );
};
