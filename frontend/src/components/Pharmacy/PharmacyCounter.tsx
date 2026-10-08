import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { StatusBadge } from '../common/StatusBadge';
import { MedicineList } from '../Medicines/MedicineList';
import { CareOrder, ORDER_TYPE_LABEL, money } from '../Queue/types';
import { Package, RefreshCw, Pill, AlertTriangle, Boxes, Receipt } from 'lucide-react';
import { PrintableInvoiceModal, InvoiceItem } from '../Invoices/PrintableInvoiceModal';
import { RetailPOS } from './RetailPOS';
import { StockRefill } from './StockRefill';
import { ExpiryDashboard } from './ExpiryDashboard';

const todayStr = () => new Date().toISOString().split('T')[0];

type Tab = 'counter' | 'stock' | 'retail' | 'refill' | 'expiries';

interface PatientGroup {
  key: string;
  patientName: string;
  patientPhone: string;
  token?: number;
  careType?: string;
  orders: CareOrder[];
  total: number;
  pending: number;
}

/**
 * The pharmacy desk. Everything a doctor ordered that draws on stock lands here,
 * grouped per patient, with the amount to collect. Dispensing deducts stock.
 */
export const PharmacyCounter: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>('counter');
  const [orders, setOrders] = useState<CareOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [printingInvoice, setPrintingInvoice] = useState<InvoiceItem | null>(null);

  const fetchOrders = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date, pendingDispense: 'true' });
      const res = await apiFetch(`/api/care-orders?${params}`, { signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to load pharmacy queue' }));
        throw new Error(err.message || 'Failed to load pharmacy queue');
      }
      const data = await res.json();
      if (signal?.aborted) return;
      setOrders(Array.isArray(data) ? data : data.data || []);
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
  const groups: PatientGroup[] = Object.values(
    orders.reduce((acc: Record<string, PatientGroup>, o) => {
      const key = o.queue?.id || o.patient?.id || o.id;
      if (!acc[key]) {
        acc[key] = {
          key,
          patientName: o.patient?.name || 'Unknown',
          patientPhone: o.patient?.phone || '',
          token: o.queue?.tokenNumber,
          careType: o.queue?.careType,
          orders: [],
          total: 0,
          pending: 0,
        };
      }
      acc[key].orders.push(o);
      acc[key].total += Number(o.totalPrice);
      if (!o.dispensedAt) acc[key].pending += 1;
      return acc;
    }, {}),
  );

  const grandTotal = groups.reduce((s, g) => s + g.total, 0);

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
                Medicines and injections ordered by doctors. Dispensing hands the item over and deducts it from stock.
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
                <p className="text-xl font-semibold text-ink-primary mt-0.5">{groups.length}</p>
              </div>
              <div className="bg-surface-card rounded-[10px] border border-border p-3.5 shadow-xs">
                <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Items to dispense</p>
                <p className="text-xl font-semibold text-ink-primary mt-0.5">{orders.length}</p>
              </div>
              <div className="bg-brand-soft/60 rounded-[10px] border border-brand/20 p-3.5 shadow-xs">
                <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Value to collect</p>
                <p className="text-xl font-semibold text-brand-deep mt-0.5">{money(grandTotal)}</p>
              </div>
            </div>
          )}

          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : groups.length === 0 ? (
            <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2">
              <p className="text-sm font-semibold text-ink-primary">Nothing to dispense</p>
              <p className="text-xs text-ink-secondary">
                Medicine and injection orders appear here as soon as a doctor raises them.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.key} className="bg-surface-card rounded-[10px] border border-border shadow-xs overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border bg-surface-page/50">
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
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Amount</p>
                      <p className="text-sm font-semibold text-brand-deep">{money(g.total)}</p>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    {g.orders.map((o) => {
                      const stock = o.medicine?.stockQty ?? 0;
                      const short = stock < o.quantity;
                      return (
                        <div
                          key={o.id}
                          className="flex flex-wrap items-center justify-between gap-3 bg-surface-page p-3 rounded-lg border border-border"
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
                              {o.medicine && ` · ${stock} ${o.medicine.unit} in stock`}
                            </p>
                            {short && (
                              <p className="text-[11px] text-status-danger flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3" /> Not enough stock
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <StatusBadge
                              label={o.status === 'DONE' ? 'Given to patient' : 'Ordered'}
                              variant={o.status === 'DONE' ? 'success' : 'warning'}
                            />
                            <button
                              onClick={() => dispense(o)}
                              disabled={busyId === o.id || short}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title={short ? 'Insufficient stock to dispense' : 'Dispense and deduct stock'}
                            >
                              <Package className="w-3.5 h-3.5" />
                              {busyId === o.id ? 'Dispensing...' : 'Dispense'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
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
    </div>
  );
};
