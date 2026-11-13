import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { CalendarClock, UserCheck, UserX } from 'lucide-react';
import { drName } from '../../utils/names';

interface Appointment {
  id: string;
  startTime: string;
  status: string;
  reasonForVisit?: string;
  patient: { id: string; name: string; phone: string };
  doctor: { id: string; name: string };
}

interface Props {
  /** YYYY-MM-DD — the day the queue board is showing. */
  date: string;
  /** Only show this doctor's bookings (the doctor's "My Patients" view). */
  doctorId?: string;
  /** Reception/RM can mark arrival; doctors just see who is coming. */
  canCheckIn: boolean;
  /** Called after a patient is moved into the queue, so the board reloads. */
  onArrived: () => void;
  /** Bumped by the board on every refresh so this list reloads with it. */
  refreshKey: number;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

/**
 * Today's booked appointments that are not in the queue yet, shown above the
 * queue on the Patient Queue page. Pressing "Arrived" checks the patient in for
 * their booked doctor, which moves them into the queue below.
 */
export const BookedAppointments: React.FC<Props> = ({ date, doctorId, canCheckIn, onArrived, refreshKey }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  // Everyone in that day's queue, unfiltered — the board's own list may be narrowed
  // by search or status, and a queued patient must never be listed here again.
  const [queuedPatientIds, setQueuedPatientIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      const params = new URLSearchParams({ date });
      if (doctorId) params.set('doctorId', doctorId);
      const [apptRes, queueRes] = await Promise.all([
        apiFetch(`/api/appointments?${params}`),
        apiFetch(`/api/queue?date=${date}`),
      ]);
      if (!apptRes.ok) return;
      const data = await apptRes.json();
      if (queueRes.ok) {
        const q = await queueRes.json();
        const rows: { patientId: string }[] = Array.isArray(q) ? q : q.data || [];
        setQueuedPatientIds(new Set(rows.map((r) => r.patientId)));
      }
      setAppointments(Array.isArray(data) ? data : data.data || []);
    } catch {
      // Non-fatal: the queue itself still works without this list.
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, doctorId, refreshKey]);

  // Waiting to arrive, plus any marked Arrived before arrival put them in the queue.
  const pending = appointments.filter(
    (a) => (a.status === 'Scheduled' || a.status === 'Checked-In') && !queuedPatientIds.has(a.patient?.id),
  );

  const arrive = async (a: Appointment) => {
    setBusyId(a.id);
    try {
      const res = await apiFetch(`/api/appointments/${a.id}/arrive`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not check the patient in');
      const token = data.queueEntry?.tokenNumber;
      addToast('success', `${a.patient?.name} added to the queue${token ? ` — token ${token}` : ''}`);
      onArrived();
    } catch (err: any) {
      addToast('error', err.message || 'Could not check the patient in');
    } finally {
      setBusyId(null);
    }
  };

  const noShow = async (a: Appointment) => {
    setBusyId(a.id);
    try {
      const res = await apiFetch(`/api/appointments/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'No-Show' }),
      });
      if (!res.ok) throw new Error('Could not update the appointment');
      addToast('success', `${a.patient?.name} marked as no-show`);
      load();
    } catch (err: any) {
      addToast('error', err.message || 'Could not update the appointment');
    } finally {
      setBusyId(null);
    }
  };

  if (pending.length === 0) return null;

  return (
    <div className="bg-surface-card rounded-[10px] border border-brand/30 shadow-xs overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-brand-soft/60 flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-brand-deep" />
        <h3 className="text-sm font-semibold text-brand-deep">Booked appointments — not arrived yet ({pending.length})</h3>
      </div>
      <p className="px-4 pt-2 text-[11px] text-ink-secondary">
        {canCheckIn
          ? 'When the patient reaches the desk, press Arrived. They move into the queue below for their doctor.'
          : 'Patients booked to see you. They join your queue once reception marks them arrived.'}
      </p>
      <ul className="divide-y divide-border/60">
        {pending.map((a) => {
          const late = a.status === 'Scheduled' && new Date(a.startTime).getTime() < Date.now() - 15 * 60000;
          return (
            <li key={a.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono font-semibold text-ink-primary w-[72px] shrink-0">{fmtTime(a.startTime)}</span>
                <div className="min-w-0">
                  <p className="font-medium text-ink-primary truncate">
                    {a.patient?.name}
                    {late && <span className="ml-2 text-[10px] font-semibold text-status-warning">Running late</span>}
                  </p>
                  <p className="text-[11px] text-ink-secondary truncate">
                    <span className="font-mono">{a.patient?.phone}</span>
                    {a.doctor && ` • ${drName(a.doctor.name)}`}
                    {a.reasonForVisit && ` • ${a.reasonForVisit}`}
                  </p>
                </div>
              </div>
              {canCheckIn && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => arrive(a)}
                    disabled={busyId === a.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    {busyId === a.id ? 'Adding...' : 'Arrived'}
                  </button>
                  {a.status === 'Scheduled' && (
                    <button
                      onClick={() => noShow(a)}
                      disabled={busyId === a.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/20 rounded-md cursor-pointer disabled:opacity-50"
                    >
                      <UserX className="w-3.5 h-3.5" /> No-show
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
