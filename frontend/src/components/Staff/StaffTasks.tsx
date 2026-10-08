import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { StatusBadge } from '../common/StatusBadge';
import { CareOrder, ORDER_TYPE_LABEL } from '../Queue/types';
import { Check, RefreshCw, ClipboardCheck, Repeat } from 'lucide-react';

const todayStr = () => new Date().toISOString().split('T')[0];

/**
 * The service desk's worklist: everything a doctor has ordered today that has not
 * been carried out yet. Staff tick items off as they treat the patient.
 */
export const StaffTasks: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [orders, setOrders] = useState<CareOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr());
  const [showDone, setShowDone] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const fetchOrders = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      params.set('status', showDone ? 'ORDERED,DONE' : 'ORDERED');
      const res = await apiFetch(`/api/care-orders?${params}`, { signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to load tasks' }));
        throw new Error(err.message || 'Failed to load tasks');
      }
      const data = await res.json();
      if (signal?.aborted) return;
      setOrders(Array.isArray(data) ? data : data.data || []);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addToast('error', err.message || 'Failed to load tasks');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchOrders(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, showDone]);

  const markDone = async (order: CareOrder) => {
    setBusyId(order.id);
    try {
      const res = await apiFetch(`/api/care-orders/${order.id}/perform`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performNotes: notes[order.id]?.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to mark done');
      addToast('success', `${order.description} marked done`);
      setNotes((prev) => ({ ...prev, [order.id]: '' }));
      fetchOrders();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to mark done');
    } finally {
      setBusyId(null);
    }
  };

  const pending = orders.filter((o) => o.status === 'ORDERED');

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-brand" />
            My Care Tasks
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5 hidden sm:block">
            Treatments, drugs and injections the doctor has ordered. Tick each one off once you have given it.
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
            onClick={() => setShowDone((v) => !v)}
            className={`px-3 py-2 text-xs font-medium rounded-md border transition-colors cursor-pointer shrink-0 ${
              showDone
                ? 'bg-brand text-white border-brand shadow-xs'
                : 'bg-surface-card text-ink-primary border-border hover:bg-surface-page'
            }`}
          >
            {showDone ? 'Showing All' : 'Pending Only'}
          </button>
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

      <div className="bg-surface-card rounded-[10px] border border-border p-3.5 shadow-xs flex items-center gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Pending</p>
          <p className="text-xl font-semibold text-ink-primary mt-0.5">{pending.length}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Patients</p>
          <p className="text-xl font-semibold text-ink-primary mt-0.5">
            {new Set(pending.map((o) => o.patient?.id)).size}
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : orders.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2">
          <p className="text-sm font-semibold text-ink-primary">Nothing to do right now</p>
          <p className="text-xs text-ink-secondary">
            Orders appear here as soon as a doctor raises them for a patient in the queue.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="bg-surface-card rounded-[10px] border border-border shadow-xs p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {o.queue && (
                      <span className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded bg-brand-soft border border-brand/20 text-brand-deep font-mono font-semibold text-[11px]">
                        {o.queue.tokenNumber}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-ink-primary">{o.patient?.name}</span>
                    {o.queue?.careType && (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-page border border-border text-ink-secondary">
                        {o.queue.careType}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-secondary font-mono mt-0.5">{o.patient?.phone}</p>
                </div>
                <StatusBadge
                  label={o.status === 'DONE' ? 'Done' : 'To do'}
                  variant={o.status === 'DONE' ? 'success' : 'warning'}
                />
              </div>

              <div className="bg-surface-page p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-ink-primary">{o.description}</span>
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-card border border-border text-ink-secondary">
                    {ORDER_TYPE_LABEL[o.orderType] || o.orderType}
                  </span>
                </div>
                <p className="text-[11px] text-ink-secondary mt-1">
                  Qty {o.quantity}
                  {o.dosage && ` · ${o.dosage}`}
                  {o.route && ` · ${o.route}`}
                  {o.frequency && ` · ${o.frequency}`}
                </p>
                {o.instructions && (
                  <p className="text-[11px] text-ink-primary mt-1.5 p-2 rounded bg-surface-card border border-border">
                    <span className="font-semibold">Doctor's instruction: </span>
                    {o.instructions}
                  </p>
                )}
                {o.orderedBy && (
                  <p className="text-[10px] text-ink-secondary/70 mt-1">Ordered by {o.orderedBy.name}</p>
                )}
              </div>

              {o.status === 'ORDERED' ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={notes[o.id] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [o.id]: e.target.value }))}
                    placeholder="Note (optional) — e.g. patient tolerated well"
                    className="flex-1 px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <button
                    onClick={() => markDone(o)}
                    disabled={busyId === o.id}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {busyId === o.id ? 'Saving...' : 'Mark Done'}
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-ink-secondary flex items-center gap-1.5">
                  <Repeat className="w-3 h-3" />
                  Done by {o.performedBy?.name}
                  {o.performedAt && ` at ${new Date(o.performedAt).toLocaleTimeString()}`}
                  {o.performNotes && ` — ${o.performNotes}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
