import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { StatusBadge } from '../common/StatusBadge';
import { CalendarPlus, Search, X, CalendarClock } from 'lucide-react';

interface PatientOption {
  id: string;
  name: string;
  phone: string;
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  reasonForVisit?: string;
  patient: { id: string; name: string; phone: string };
  doctor: { id: string; name: string };
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

const statusVariant = (s: string) =>
  s === 'Completed' ? 'success' : s === 'Cancelled' || s === 'No-Show' ? 'danger' : s === 'Checked-In' ? 'warning' : 'accent';

/** Booking new appointments and follow-ups, plus the upcoming schedule. */
export const AppointmentsPanel: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selected, setSelected] = useState<PatientOption | null>(null);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [durationMins, setDurationMins] = useState('30');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/appointments');
      if (!res.ok) throw new Error('Failed to load appointments');
      const result = await res.json();
      const rows: Appointment[] = Array.isArray(result) ? result : result.data || [];
      // Upcoming first — the desk cares about what's ahead, not history.
      const now = Date.now();
      setAppointments(
        rows
          .filter((a) => new Date(a.startTime).getTime() >= now - 12 * 3600 * 1000)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
      );
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    (async () => {
      try {
        const res = await apiFetch('/api/users?role=DOCTOR,MASTER');
        const result = await res.json();
        setDoctors(Array.isArray(result) ? result : result.data || []);
      } catch {
        // Non-fatal.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setPatients([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/patients?search=${encodeURIComponent(search.trim())}&pageSize=8`, {
          signal: controller.signal,
        });
        const result = await res.json();
        setPatients(Array.isArray(result) ? result : result.data || []);
      } catch {
        // Non-fatal.
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !doctorId || !date) {
      addToast('error', 'Patient, doctor and date are required');
      return;
    }
    setSubmitting(true);
    try {
      const start = new Date(`${date}T${time}:00`);
      const end = new Date(start.getTime() + Number(durationMins) * 60000);
      const res = await apiFetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selected.id,
          doctorId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          reasonForVisit: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not book appointment');

      addToast('success', `Appointment booked for ${selected.name}`);
      setShowForm(false);
      setSelected(null);
      setSearch('');
      setReason('');
      setDate('');
      fetchAppointments();
    } catch (err: any) {
      addToast('error', err.message || 'Could not book appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      const res = await apiFetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Could not update appointment');
      addToast('success', `Marked ${status}`);
      fetchAppointments();
    } catch (err: any) {
      addToast('error', err.message || 'Could not update appointment');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-primary">Appointments & Follow-ups</h3>
          <p className="text-xs text-ink-secondary mt-0.5">Book a new slot or a follow-up visit for an existing patient.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer shrink-0"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          <span>Book</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleBook} className="bg-surface-page p-4 rounded-lg border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-primary">New appointment</span>
            <button type="button" onClick={() => setShowForm(false)} className="p-1 rounded text-ink-secondary hover:text-ink-primary cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Patient <span className="text-status-danger">*</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
              <input
                type="text"
                value={selected ? `${selected.name} (${selected.phone})` : search}
                onChange={(e) => {
                  setSelected(null);
                  setSearch(e.target.value);
                }}
                placeholder="Search patient..."
                className={`${inputClass} pl-9`}
              />
            </div>
            {!selected && patients.length > 0 && (
              <div className="mt-1 border border-border rounded-md divide-y divide-border/60 max-h-36 overflow-y-auto bg-surface-card">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-surface-page cursor-pointer flex items-center justify-between"
                  >
                    <span className="font-medium text-ink-primary">{p.name}</span>
                    <span className="font-mono text-ink-secondary">{p.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Doctor <span className="text-status-danger">*</span>
              </label>
              <select required value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputClass}>
                <option value="">Select</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Date <span className="text-status-danger">*</span>
              </label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Mins</label>
              <input type="number" min="5" step="5" value={durationMins} onChange={(e) => setDurationMins(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Follow-up review after laser sitting"
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3.5 py-1.5 text-xs font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded-md cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-3.5 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50">
              {submitting ? 'Booking...' : 'Book Appointment'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : appointments.length === 0 ? (
        <div className="text-ink-secondary text-xs py-8 text-center bg-surface-page rounded-lg border border-border">
          No upcoming appointments.
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((a) => {
            const start = new Date(a.startTime);
            return (
              <div key={a.id} className="bg-surface-page p-3 rounded-lg border border-border flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-soft border border-brand/20 flex items-center justify-center shrink-0">
                    <CalendarClock className="w-4 h-4 text-brand-deep" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-ink-primary">{a.patient?.name}</p>
                    <p className="text-[11px] text-ink-secondary">
                      {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {a.doctor && ` • Dr. ${a.doctor.name}`}
                      {a.reasonForVisit && ` • ${a.reasonForVisit}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={a.status} variant={statusVariant(a.status)} />
                  {a.status === 'Scheduled' && (
                    <>
                      <button onClick={() => setStatus(a.id, 'Checked-In')} className="px-2.5 py-1 text-[11px] font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded cursor-pointer">
                        Arrived
                      </button>
                      <button onClick={() => setStatus(a.id, 'No-Show')} className="px-2.5 py-1 text-[11px] font-medium text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/20 rounded cursor-pointer">
                        No-Show
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
