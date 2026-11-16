import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { MedicineList } from '../Medicines/MedicineList';
import { CareOrder, ORDER_TYPE_LABEL, money } from '../Queue/types';
import { Package, RefreshCw, Pill, AlertTriangle, Boxes, Receipt, CheckCircle2, Printer, PackageCheck, Minus, Plus, Ban } from 'lucide-react';
import { describeQty, hasPack, packText, validQty } from '../../utils/pack';
import { RetailPOS } from './RetailPOS';
import { StockRefill } from './StockRefill';
import { ExpiryDashboard } from './ExpiryDashboard';
import { PharmacyBillModal, PharmacyBillData } from './PharmacyBillModal';

/** Local calendar date — toISOString() is UTC and is still "yesterday" in IST until 5:30 am. */
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Tab = 'counter' | 'stock' | 'retail' | 'refill' | 'expiries';
type Stage = 'dispense' | 'collect' | 'paid';

type PharmacyOrder = CareOrder & { billedInvoiceId?: string | null };

interface PatientGroup {
  queueId: string;
  patientName: string;
  patientPhone: string;
  token?: number;
  careType?: string;
  orders: PharmacyOrder[];
  pending: PharmacyOrder[];
  /** Pre-GST value of everything ordered from stock. */
  total: number;
  invoiceIds: string[];
  stage: Stage;
}

const STAGE_LABEL: Record<Stage, string> = {
  dispense: '1 · Dispense',
  collect: '2 · Collect payment',
  paid: 'Paid',
};

const QuickBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer ${
      active ? 'bg-brand text-white border-brand' : 'bg-surface-card text-ink-secondary border-border hover:text-ink-primary'
    }`}
  >
    {children}
  </button>
);

/** Turns the API's bill into what the printable bill shows. */
const toBillData = (b: any, title = 'Pharmacy Bill'): PharmacyBillData => ({
  title,
  billNo: b.invoice?.invoiceNumber,
  issuedAt: b.invoice?.issuedAt,
  date: b.header?.queueDate,
  patient: b.header?.patient ?? { name: '' },
  doctor: b.header?.doctor?.name ?? null,
  token: b.header?.tokenNumber,
  lines: b.lines,
  subTotal: b.subTotal,
  cgst: b.cgst,
  sgst: b.sgst,
  totalAmount: b.invoice ? Number(b.invoice.totalAmount) : b.totalAmount,
  paymentMethod: b.invoice?.paymentMethod,
  paymentRef: b.invoice?.paymentRef,
});

/**
 * The pharmacy desk, one patient at a time:
 *   1. dispense what the doctor ordered (stock is deducted),
 *   2. collect payment — a numbered receipt that shows up in Accounts,
 *   3. print the itemised bill for the patient.
 */
export const PharmacyCounter: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>('counter');
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bill, setBill] = useState<PharmacyBillData | null>(null);
  /** Set while the bill on screen is an unpaid preview for this visit. */
  const [collectFor, setCollectFor] = useState<string | null>(null);
  /** Quantity the pharmacist will hand over, per order, when it differs from the prescription. */
  const [give, setGive] = useState<Record<string, number>>({});
  const [giveNote, setGiveNote] = useState<Record<string, string>>({});
  const qtyFor = (o: PharmacyOrder) => give[o.id] ?? o.quantity;
  const setQty = (o: PharmacyOrder, n: number) =>
    setGive((prev) => ({ ...prev, [o.id]: Math.max(0, Math.min(10000, Math.round(n) || 0)) }));

  const fetchOrders = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/care-orders?${new URLSearchParams({ date })}`, { signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to load pharmacy queue' }));
        throw new Error(err.message || 'Failed to load pharmacy queue');
      }
      const data = await res.json();
      if (signal?.aborted) return;
      const rows: PharmacyOrder[] = Array.isArray(data) ? data : data.data || [];
      // Only what the pharmacy hands over from stock. "Buy outside" lines have no
      // medicine link and never come to the counter.
      // Items the pharmacy marked "not needed" stay visible, struck through.
      setOrders(rows.filter((o) => ['MEDICINE', 'INJECTION'].includes(o.orderType) && o.medicineId && (o.status !== 'CANCELLED' || !!o.dispenseNote)));
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

  const dispenseOne = async (order: PharmacyOrder): Promise<boolean> => {
    const qty = qtyFor(order);
    const changed = qty !== order.quantity;
    const res = await apiFetch(`/api/care-orders/${order.id}/dispense`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changed ? { quantity: qty, note: giveNote[order.id]?.trim() || undefined } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || `Could not dispense ${order.description}`);
    return true;
  };

  const dispense = async (order: PharmacyOrder) => {
    setBusyId(order.id);
    try {
      await dispenseOne(order);
      const qty = qtyFor(order);
      addToast('success', qty === 0
        ? `${order.description} marked not needed — removed from the bill`
        : `${order.description}: ${describeQty(qty, order.medicine)} dispensed — stock updated`);
      await fetchOrders();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to dispense');
    } finally {
      setBusyId(null);
    }
  };

  /** Opens the unpaid bill for review, with the payment step at the bottom. */
  const openCollect = async (queueId: string) => {
    try {
      const res = await apiFetch(`/api/care-orders/pharmacy-bill/${queueId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not prepare the bill');
      if (!data.lines?.length) {
        addToast('info', 'Nothing left to bill for this patient');
        return;
      }
      setCollectFor(queueId);
      setBill(toBillData(data));
    } catch (err: any) {
      addToast('error', err.message || 'Could not prepare the bill');
    }
  };

  const dispenseAll = async (g: PatientGroup) => {
    setBusyId(g.queueId);
    let failed = 0;
    for (const o of g.pending) {
      try {
        await dispenseOne(o);
      } catch (err: any) {
        failed++;
        addToast('error', err.message || `Could not dispense ${o.description}`);
      }
    }
    await fetchOrders();
    setBusyId(null);
    if (failed === 0) {
      addToast('success', `All medicines dispensed for ${g.patientName}`);
      openCollect(g.queueId); // straight to the bill
    }
  };

  const collect = async (paymentMethod: 'cash' | 'bank', paymentRef: string) => {
    if (!collectFor) return;
    try {
      const res = await apiFetch(`/api/care-orders/pharmacy-bill/${collectFor}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod, paymentRef: paymentRef || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not collect payment');
      addToast('success', `Payment collected — receipt ${data.invoice?.invoiceNumber}`);
      setCollectFor(null);
      setBill(toBillData(data)); // the issued receipt, ready to print
      fetchOrders();
    } catch (err: any) {
      addToast('error', err.message || 'Could not collect payment');
    }
  };

  const reprint = async (queueId: string, invoiceId: string) => {
    try {
      const res = await apiFetch(`/api/care-orders/pharmacy-bill/${queueId}?invoiceId=${invoiceId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load the receipt');
      setCollectFor(null);
      setBill(toBillData(data));
    } catch (err: any) {
      addToast('error', err.message || 'Could not load the receipt');
    }
  };

  // One card per patient visit.
  const groups: PatientGroup[] = Object.values(
    orders.reduce((acc: Record<string, PatientGroup>, o) => {
      const key = o.queue?.id || o.patient?.id || o.id;
      if (!acc[key]) {
        acc[key] = {
          queueId: key,
          patientName: o.patient?.name || 'Unknown',
          patientPhone: o.patient?.phone || '',
          token: o.queue?.tokenNumber,
          careType: o.queue?.careType,
          orders: [],
          pending: [],
          total: 0,
          invoiceIds: [],
          stage: 'dispense',
        };
      }
      const g = acc[key];
      g.orders.push(o);
      if (o.status === 'CANCELLED') return acc; // marked not needed — not billed
      // Not handed over yet: price what the pharmacist is about to give.
      g.total += o.dispensedAt ? Number(o.totalPrice) : Number(o.unitPrice) * qtyFor(o);
      if (!o.dispensedAt) g.pending.push(o);
      if (o.billedInvoiceId && !g.invoiceIds.includes(o.billedInvoiceId)) g.invoiceIds.push(o.billedInvoiceId);
      return acc;
    }, {}),
  ).map((g) => {
    const unbilled = g.orders.some((o) => o.dispensedAt && !o.billedInvoiceId);
    return { ...g, stage: g.pending.length > 0 ? 'dispense' : unbilled ? 'collect' : 'paid' } as PatientGroup;
  });

  const waiting = groups.filter((g) => g.stage !== 'paid');
  const done = groups.filter((g) => g.stage === 'paid');
  const toCollect = waiting.reduce((s, g) => s + g.total, 0);

  const renderGroup = (g: PatientGroup) => (
    <div key={g.queueId} className="bg-surface-card rounded-[10px] border border-border shadow-xs overflow-hidden">
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
          <span
            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
              g.stage === 'paid'
                ? 'bg-status-success/10 text-status-success border-status-success/30'
                : g.stage === 'collect'
                  ? 'bg-brand-soft text-brand-deep border-brand/30'
                  : 'bg-status-warning/10 text-status-warning border-status-warning/30'
            }`}
          >
            {STAGE_LABEL[g.stage]}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Amount (before GST)</p>
          <p className="text-sm font-semibold text-brand-deep">{money(g.total)}</p>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {g.orders.map((o) => {
          const m = o.medicine;
          const stock = m?.stockQty ?? 0;
          const notNeeded = o.status === 'CANCELLED';
          const pending = !o.dispensedAt && !notNeeded;
          const qty = qtyFor(o);
          const changed = pending && qty !== o.quantity;
          const short = pending && stock < qty;
          const badQty = pending && !validQty(qty, m);
          // Unsplittable packs move a whole pack at a time.
          const step = hasPack(m) && m.sellLoose === false ? m.packSize : 1;
          const prescribed = o.prescribedQty ?? o.quantity;
          return (
            <div key={o.id} className={`bg-surface-page p-3 rounded-lg border space-y-2 ${changed ? 'border-brand/40' : 'border-border'} ${notNeeded ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[180px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold text-ink-primary ${notNeeded ? 'line-through' : ''}`}>{o.description}</span>
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-card border border-border text-ink-secondary">
                      {ORDER_TYPE_LABEL[o.orderType] || o.orderType}
                    </span>
                    {hasPack(m) && (
                      <span className="text-[10px] text-ink-faint">
                        {packText(m)} = {money(Number(o.unitPrice) * m.packSize)}{m.sellLoose === false ? ' · whole packs only' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-secondary mt-0.5">
                    Prescribed: <span className="font-medium text-ink-primary">{describeQty(prescribed, m)}</span>
                    {' · '}{money(o.unitPrice)} per {m?.unit || 'unit'}
                    {pending && m && ` · ${stock} ${m.unit} in stock`}
                    {o.dosage && ` · ${o.dosage}`}
                    {o.frequency && ` · ${o.frequency}`}
                  </p>
                </div>

                {o.dispensedAt ? (
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-status-success">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Gave {describeQty(o.quantity, m)}
                    </span>
                    <p className="text-[11px] text-ink-secondary">{money(o.totalPrice)}</p>
                  </div>
                ) : notNeeded ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-secondary">
                    <Ban className="w-3.5 h-3.5" /> Not given
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Give</p>
                      <div className="inline-flex items-center rounded-md border border-border bg-surface-card overflow-hidden">
                        <button onClick={() => setQty(o, qty - step)} disabled={qty <= 0} className="px-1.5 py-1 text-ink-secondary hover:bg-surface-page disabled:opacity-30 cursor-pointer" title={`One ${step > 1 ? m?.packLabel || 'pack' : m?.unit || 'unit'} less`}>
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          step={step}
                          value={qty}
                          onChange={(e) => setQty(o, Number(e.target.value))}
                          className="w-12 text-center text-xs font-mono font-semibold bg-transparent outline-none py-1"
                        />
                        <button onClick={() => setQty(o, qty + step)} className="px-1.5 py-1 text-ink-secondary hover:bg-surface-page cursor-pointer" title={`One ${step > 1 ? m?.packLabel || 'pack' : m?.unit || 'unit'} more`}>
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right min-w-[70px]">
                      <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Amount</p>
                      <p className="text-xs font-semibold text-brand-deep">{money(Number(o.unitPrice) * qty)}</p>
                    </div>
                    <button
                      onClick={() => dispense(o)}
                      disabled={busyId === o.id || busyId === g.queueId || short || badQty}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title={short ? 'Insufficient stock to dispense' : badQty ? 'Give whole packs' : qty === 0 ? 'Mark as not needed' : 'Dispense and deduct stock'}
                    >
                      {qty === 0 ? <Ban className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                      {busyId === o.id ? 'Saving...' : qty === 0 ? 'Not needed' : 'Dispense'}
                    </button>
                  </div>
                )}
              </div>

              {pending && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-ink-faint mr-0.5">Quick:</span>
                  <QuickBtn active={qty === o.quantity} onClick={() => setQty(o, o.quantity)}>As prescribed ({o.quantity})</QuickBtn>
                  {hasPack(m) && m.packSize !== o.quantity && (
                    <QuickBtn active={qty === m.packSize} onClick={() => setQty(o, m.packSize)}>1 {m.packLabel || 'pack'} ({m.packSize})</QuickBtn>
                  )}
                  {hasPack(m) && o.quantity % m.packSize !== 0 && Math.ceil(o.quantity / m.packSize) * m.packSize !== m.packSize && (
                    <QuickBtn active={qty === Math.ceil(o.quantity / m.packSize) * m.packSize} onClick={() => setQty(o, Math.ceil(o.quantity / m.packSize) * m.packSize)}>
                      Round up to full {m.packLabel || 'pack'}s ({Math.ceil(o.quantity / m.packSize) * m.packSize})
                    </QuickBtn>
                  )}
                  {o.quantity > 1 && (m?.sellLoose !== false || !hasPack(m)) && o.quantity % 2 === 0 && (
                    <QuickBtn active={qty === o.quantity / 2} onClick={() => setQty(o, o.quantity / 2)}>Half ({o.quantity / 2})</QuickBtn>
                  )}
                  <QuickBtn active={qty === 0} onClick={() => setQty(o, 0)}>None — has it at home</QuickBtn>
                </div>
              )}

              {changed && (
                <input
                  type="text"
                  value={giveNote[o.id] ?? ''}
                  onChange={(e) => setGiveNote((prev) => ({ ...prev, [o.id]: e.target.value }))}
                  maxLength={200}
                  placeholder={qty < o.quantity ? `Reason, e.g. patient has ${o.quantity - qty} at home` : 'Reason, e.g. rounded up to a full strip'}
                  className="w-full px-2.5 py-1.5 rounded-md border border-border text-[11px] bg-surface-card focus:outline-none focus:ring-1 focus:ring-brand"
                />
              )}

              {short && (
                <p className="text-[11px] text-status-danger flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Not enough stock for {qty} — give fewer or refill first
                </p>
              )}
              {badQty && !short && (
                <p className="text-[11px] text-status-danger flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {m?.name} can't be split — give whole {m?.packLabel || 'pack'}s ({m?.packSize} {m?.unit}s each)
                </p>
              )}
              {(o.dispensedAt || notNeeded) && o.prescribedQty != null && (o.prescribedQty !== o.quantity || notNeeded) && (
                <p className="text-[11px] text-ink-secondary">
                  {notNeeded ? 'None given' : `Gave ${o.quantity} of ${o.prescribedQty} prescribed`}
                  {o.dispenseNote && ` — ${o.dispenseNote}`}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 px-4 pb-4">
        {g.stage === 'dispense' && (
          <button
            onClick={() => dispenseAll(g)}
            disabled={busyId === g.queueId || g.pending.some((o) => (o.medicine?.stockQty ?? 0) < qtyFor(o) || !validQty(qtyFor(o), o.medicine))}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
          >
            <PackageCheck className="w-4 h-4" />
            {busyId === g.queueId ? 'Dispensing...' : g.pending.length > 1 ? `Dispense all ${g.pending.length} & bill` : 'Dispense & bill'}
          </button>
        )}
        {g.stage === 'collect' && (
          <button
            onClick={() => openCollect(g.queueId)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer"
          >
            <Receipt className="w-4 h-4" /> Collect payment & print bill
          </button>
        )}
        {g.invoiceIds.map((inv, i) => (
          <button
            key={inv}
            onClick={() => reprint(g.queueId, inv)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded-md cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> {g.invoiceIds.length > 1 ? `Print bill ${i + 1}` : 'Print bill'}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 font-sans text-ink-primary">
      <div className="flex items-center gap-1 bg-surface-card px-2 rounded-[10px] border border-border shadow-xs overflow-x-auto">
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
              className={`inline-flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
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
        <RetailPOS
          onInvoiceGenerated={(inv: any) => {
            setCollectFor(null);
            setBill({
              title: 'Retail Sale',
              billNo: inv.invoiceNumber,
              issuedAt: inv.issuedAt,
              patient: { name: inv.customer?.name || inv.patientName || 'Walk-in Customer', phone: inv.customer?.phone, uhid: 'RETAIL' },
              lines: inv.lines || [],
              subTotal: Number(inv.subTotal ?? inv.taxableValue),
              cgst: Number(inv.cgst),
              sgst: Number(inv.sgst),
              totalAmount: Number(inv.totalAmount),
              paymentMethod: inv.paymentMethod,
              paymentRef: inv.paymentRef,
            });
          }}
        />
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
                Dispense what the doctor ordered, collect payment, and print the patient's bill.
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-surface-card rounded-[10px] border border-border p-3.5 shadow-xs">
                <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Patients waiting</p>
                <p className="text-xl font-semibold text-ink-primary mt-0.5">{waiting.length}</p>
              </div>
              <div className="bg-surface-card rounded-[10px] border border-border p-3.5 shadow-xs">
                <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Items to dispense</p>
                <p className="text-xl font-semibold text-ink-primary mt-0.5">{waiting.reduce((s, g) => s + g.pending.length, 0)}</p>
              </div>
              <div className="bg-brand-soft/60 rounded-[10px] border border-brand/20 p-3.5 shadow-xs">
                <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">To collect (before GST)</p>
                <p className="text-xl font-semibold text-brand-deep mt-0.5">{money(toCollect)}</p>
              </div>
            </div>
          )}

          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : groups.length === 0 ? (
            <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2">
              <p className="text-sm font-semibold text-ink-primary">Nothing to dispense</p>
              <p className="text-xs text-ink-secondary">Medicine and injection orders appear here as soon as a doctor raises them.</p>
            </div>
          ) : (
            <>
              {waiting.length > 0 ? (
                <div className="space-y-3">{waiting.map(renderGroup)}</div>
              ) : (
                <div className="bg-surface-card rounded-[10px] border border-border p-8 text-center text-xs text-ink-secondary">
                  Everyone is served for this day.
                </div>
              )}
              {done.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary pt-2">
                    Paid ({done.length}) — reprint a bill any time
                  </h3>
                  {done.map(renderGroup)}
                </div>
              )}
            </>
          )}
        </>
      )}

      <PharmacyBillModal
        bill={bill}
        onClose={() => {
          setBill(null);
          setCollectFor(null);
        }}
        onCollect={collectFor ? collect : undefined}
      />
    </div>
  );
};
