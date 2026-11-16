import React, { useEffect, useState } from 'react';
import { Syringe, UserCheck, UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface BookedSitting {
  bookingId: string;
  purchaseId: string;
  packageName: string;
  patient: { id: string; name: string; phone: string; uhid: string };
  time: string | null;
  note: string | null;
  bookedBy: string | null;
  treatments: { id: string; name: string; sittingNumber: number; totalSittings: number }[];
}

interface Props {
  /** YYYY-MM-DD */
  date: string;
  /** Reception marks arrival; nurses/staff just see who is coming. */
  canCheckIn: boolean;
  /** Called after a patient is checked in, so the page reloads its queue. */
  onArrived?: () => void;
  /** Bumped by the parent on refresh so this list reloads with it. */
  refreshKey?: number;
  /** Show an empty state instead of hiding the section when nobody is booked. */
  showEmpty?: boolean;
}

/** "17:20" -> "05:20 pm" */
const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

/**
 * Package sittings booked for the day (done by the nurse/staff, no doctor) whose
 * patient hasn't arrived yet. Reception presses Arrived to check them in for the
 * sitting — the nurse then gets the care order as usual.
 */
export const BookedSittings: React.FC<Props> = ({ date, canCheckIn, onArrived, refreshKey, showEmpty }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [rows, setRows] = useState<BookedSitting[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await apiFetch(`/api/follow-ups/sittings/booked?date=${date}`);
      if (res.ok) setRows(await res.json());
    } catch {
      // Non-fatal — the rest of the page works without this list.
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, refreshKey]);

  const arrive = async (b: BookedSitting) => {
    setBusyId(b.bookingId);
    try {
      const res = await apiFetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: b.patient.id, sittingPurchaseId: b.purchaseId, sittingItemIds: b.treatments.map((t) => t.id) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Could not check the patient in');
      addToast('success', `${b.patient.name} checked in for the sitting${data.tokenNumber ? ` — token ${data.tokenNumber}` : ''}`);
      await load();
      onArrived?.();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setBusyId(null);
    }
  };

  const noShow = async (b: BookedSitting) => {
    setBusyId(b.bookingId);
    try {
      const res = await apiFetch('/api/follow-ups/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: b.patient.id, kind: 'PACKAGE_SITTING', refId: b.purchaseId, dueDate: date, outcome: 'NO_SHOW',
          note: 'Did not come for the booked sitting',
        }),
      });
      if (!res.ok) throw new Error('Could not mark the no-show');
      addToast('success', `${b.patient.name} marked as no-show — back on the Package Sittings call list`);
      await load();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (rows.length === 0 && !showEmpty) return null;

  const now = new Date();
  const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isToday = date === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="bg-surface-card rounded-[10px] border border-brand/30 shadow-xs overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-brand-soft/60 flex items-center gap-2">
        <Syringe className="w-4 h-4 text-brand-deep" />
        <h3 className="text-sm font-semibold text-brand-deep">Booked sittings — not arrived yet ({rows.length})</h3>
      </div>
      <p className="px-4 pt-2 text-[11px] text-ink-secondary">
        {canCheckIn
          ? 'Package procedures booked with the nurse / staff. When the patient reaches the desk, press Arrived — the nurse gets the sitting in the queue.'
          : 'Patients coming for a package procedure today. They join the queue once reception marks them arrived.'}
      </p>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-xs text-ink-faint">No sittings booked for this day.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((b) => {
            // Count a missing time as "any time today" — never late.
            const late = isToday && !!b.time && b.time < nowHm && (() => {
              const [h, m] = b.time!.split(':').map(Number);
              return now.getHours() * 60 + now.getMinutes() - (h * 60 + m) > 15;
            })();
            return (
              <li key={b.bookingId} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono font-semibold text-ink-primary w-[72px] shrink-0">{b.time ? fmtTime(b.time) : 'Any time'}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-ink-primary truncate">
                      {b.patient.name}
                      <span className="ml-2 font-mono text-[10px] text-brand">{b.patient.uhid}</span>
                      {late && <span className="ml-2 text-[10px] font-semibold text-status-warning">Running late</span>}
                    </p>
                    <p className="text-[11px] text-ink-secondary truncate">
                      <span className="font-mono">{b.patient.phone}</span>
                      {' • '}
                      {b.treatments.map((t) => `${t.name} sitting ${t.sittingNumber} of ${t.totalSittings}`).join(' · ')}
                      {' • '}
                      {b.packageName}
                    </p>
                    {b.note && <p className="text-[11px] text-ink-faint italic truncate">“{b.note}”</p>}
                  </div>
                </div>
                {canCheckIn && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => arrive(b)}
                      disabled={busyId === b.bookingId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      {busyId === b.bookingId ? 'Adding...' : 'Arrived'}
                    </button>
                    <button
                      onClick={() => noShow(b)}
                      disabled={busyId === b.bookingId}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/20 rounded-md cursor-pointer disabled:opacity-50"
                    >
                      <UserX className="w-3.5 h-3.5" /> No-show
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
