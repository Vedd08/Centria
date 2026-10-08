import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { StatusBadge } from '../common/StatusBadge';
import { CareRail } from '../common/CareRail';
import { CheckInModal } from './CheckInModal';
import { QueueDetail } from './QueueDetail';
import { QueueEntry, QUEUE_STATUS_LABEL, queueStatusVariant } from './types';
import { UserPlus, Search, Repeat, RefreshCw, ClipboardList } from 'lucide-react';

const todayStr = () => new Date().toISOString().split('T')[0];

interface Stats {
  waiting: number;
  withDoctor: number;
  awaitingService: number;
  inService: number;
  completed: number;
  pendingCareOrders: number;
}

/**
 * The live board every desk works from. Reception checks patients in here, the
 * doctor picks the next waiting patient, and staff watch for service work.
 */
export const QueueBoard: React.FC = () => {
  const { apiFetch, user, hasRole } = useAuth();
  const { addToast } = useToast();
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(todayStr());
  const [statusFilter, setStatusFilter] = useState('');
  const [mineOnly, setMineOnly] = useState(user?.role === 'DOCTOR');
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [selected, setSelected] = useState<QueueEntry | null>(null);

  const canCheckIn = hasRole('RECEPTION', 'RM');
  const isDoctor = user?.role === 'DOCTOR' || hasRole('MASTER', 'SUPER_ADMIN');

  // Tracks each entry's status as of the last fetch, so a background poll can tell
  // reception the moment a doctor finishes — without them having to watch the board.
  const lastStatusRef = useRef<Record<string, string>>({});

  const fetchBoard = async (signal?: AbortSignal, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (mineOnly && user?.id) params.set('doctorId', user.id);

      const [listRes, statsRes] = await Promise.all([
        apiFetch(`/api/queue?${params}`, { signal }),
        apiFetch(`/api/queue/stats?date=${date}`, { signal }),
      ]);
      if (!listRes.ok) {
        const err = await listRes.json().catch(() => ({ message: 'Failed to load queue' }));
        throw new Error(err.message || 'Failed to load queue');
      }
      const list = await listRes.json();
      if (signal?.aborted) return;
      const nextEntries: QueueEntry[] = Array.isArray(list) ? list : list.data || [];

      if (canCheckIn) {
        const lastStatus = lastStatusRef.current;
        for (const entry of nextEntries) {
          const wasStatus = lastStatus[entry.id];
          if (entry.status === 'COMPLETED' && wasStatus && wasStatus !== 'COMPLETED') {
            addToast(
              'info',
              `Token ${entry.tokenNumber} — ${entry.patient?.name} is done with ${
                entry.doctor?.name ? `Dr. ${entry.doctor.name}` : 'the doctor'
              }. Send in the next patient.`,
            );
          }
        }
        lastStatusRef.current = Object.fromEntries(nextEntries.map((e) => [e.id, e.status]));
      }

      setEntries(nextEntries);
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (!opts?.silent) addToast('error', err.message || 'Failed to load queue');
    } finally {
      if (!signal?.aborted && !opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => fetchBoard(controller.signal), search.trim() ? 300 : 0);
    // Reception/RM get a background poll so "send next patient" doesn't depend on
    // them manually refreshing right as the doctor finishes.
    const pollInterval = canCheckIn ? setInterval(() => fetchBoard(undefined, { silent: true }), 20000) : undefined;
    return () => {
      clearTimeout(timer);
      controller.abort();
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, date, statusFilter, mineOnly]);

  // Keep the selected patient's detail in step with the board after an action.
  const refreshSelected = async () => {
    if (!selected) return;
    try {
      const res = await apiFetch(`/api/queue/${selected.id}`);
      if (res.ok) setSelected(await res.json());
    } catch {
      // Non-fatal — the board below refreshes regardless.
    }
    fetchBoard();
  };

  if (selected) {
    return (
      <QueueDetail
        entry={selected}
        onBack={() => {
          setSelected(null);
          fetchBoard();
        }}
        onChanged={refreshSelected}
      />
    );
  }

  const statTiles = stats
    ? [
        { label: 'Waiting', value: stats.waiting },
        { label: 'With Doctor', value: stats.withDoctor },
        { label: 'Awaiting Service', value: stats.awaitingService },
        { label: 'In Service', value: stats.inService },
        { label: 'Completed', value: stats.completed },
        { label: 'Pending Orders', value: stats.pendingCareOrders },
      ]
    : [];

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-brand" />
            Patient Queue
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5 hidden sm:block">
            Reception checks patients in; the doctor assesses and routes them to OPD or IPD; staff carry out the orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-[170px] sm:w-52">
            <Search className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border text-xs focus:outline-none focus:ring-1 focus:ring-brand bg-surface-card"
            />
          </div>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
          >
            <option value="">All Statuses</option>
            {Object.entries(QUEUE_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {isDoctor && user?.role === 'DOCTOR' && (
            <button
              onClick={() => setMineOnly((v) => !v)}
              className={`px-3 py-2 text-xs font-medium rounded-md border transition-colors cursor-pointer shrink-0 ${
                mineOnly
                  ? 'bg-brand text-white border-brand shadow-xs'
                  : 'bg-surface-card text-ink-primary border-border hover:bg-surface-page'
              }`}
            >
              {mineOnly ? 'My Patients' : 'All Patients'}
            </button>
          )}

          <button
            onClick={() => fetchBoard()}
            disabled={loading}
            className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border transition-colors cursor-pointer shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {canCheckIn && (
            <button
              onClick={() => setShowCheckIn(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Check In Patient</span>
            </button>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statTiles.map((t) => (
            <div key={t.label} className="bg-surface-card rounded-[10px] border border-border p-3.5 shadow-xs">
              <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">{t.label}</p>
              <p className="text-xl font-semibold text-ink-primary mt-0.5">{t.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : entries.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2">
          <p className="text-sm font-semibold text-ink-primary">No patients in the queue</p>
          <p className="text-xs text-ink-secondary">
            {canCheckIn
              ? 'Click "Check In Patient" when someone arrives at the desk.'
              : 'Patients appear here once reception checks them in.'}
          </p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-page border-b border-border text-ink-secondary font-medium text-xs">
                  <th className="py-3 px-4">Token</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Complaint</th>
                  <th className="py-3 px-4">Doctor</th>
                  <th className="py-3 px-4">Care</th>
                  <th className="py-3 px-4">Orders</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-ink-primary">
                {entries.map((e) => {
                  const pending = e.careOrders?.filter((o) => o.status === 'ORDERED').length ?? 0;
                  return (
                    <tr key={e.id} className="hover:bg-surface-page/60 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        {/* Token reads as its department's series, e.g. CARD-004. */}
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded bg-brand-soft border border-brand/20 text-brand-deep font-mono font-semibold">
                          {e.department ? `${e.department.code}-` : ''}
                          {String(e.tokenNumber).padStart(3, '0')}
                        </span>
                        {e.department && (
                          <p className="text-[10px] text-ink-faint mt-0.5 max-w-[90px] truncate" title={e.department.name}>
                            {e.department.name}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-ink-primary">{e.patient?.name}</span>
                        {e.isRegular && (
                          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-soft text-brand-deep border border-brand/20">
                            <Repeat className="w-2.5 h-2.5" /> Regular
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-ink-secondary">{e.patient?.phone}</td>
                      <td className="py-3 px-4 text-ink-secondary max-w-[180px] truncate" title={e.complaint}>
                        {e.complaint || '—'}
                      </td>
                      <td className="py-3 px-4 text-ink-secondary">{e.doctor?.name || 'Unassigned'}</td>
                      <td className="py-3 px-4">
                        {e.careType ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-page border border-border text-ink-primary">
                            {e.careType}
                          </span>
                        ) : (
                          <span className="text-ink-secondary/60">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-ink-secondary">
                        {e.careOrders?.length ? (
                          <span>
                            {e.careOrders.length}
                            {pending > 0 && <span className="text-status-warning font-semibold"> ({pending} pending)</span>}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge label={QUEUE_STATUS_LABEL[e.status] || e.status} variant={queueStatusVariant(e.status)} />
                        <CareRail status={e.status} pendingDispense={pending > 0} className="mt-1.5 w-28" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelected(e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded transition-colors cursor-pointer"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CheckInModal isOpen={showCheckIn} onClose={() => setShowCheckIn(false)} onCheckedIn={fetchBoard} />
    </div>
  );
};
