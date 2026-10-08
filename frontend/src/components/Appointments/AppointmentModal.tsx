import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { X, Calendar, Clock, User, Stethoscope } from 'lucide-react';
import { Appointment } from './AppointmentsCalendar';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  appointment: Appointment | null;
  initialSlot: { start: Date; end: Date } | null;
  onLogVisit?: (appointment: Appointment) => void;
}

export const AppointmentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSaved,
  appointment,
  initialSlot,
  onLogVisit,
}) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();

  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);

  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotDuration, setSlotDuration] = useState(15);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [status, setStatus] = useState('Scheduled');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchDropdowns();
      if (appointment) {
        setPatientId(appointment.patientId);
        setDoctorId(appointment.doctorId);
        
        const d = new Date(appointment.startTime);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setAppointmentDate(`${yyyy}-${mm}-${dd}`);
        
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        setSelectedSlot(`${h}:${m}`);
        
        setStatus(appointment.status);
        setReason(appointment.reasonForVisit || '');
      } else if (initialSlot) {
        setPatientId('');
        setDoctorId('');
        
        const d = new Date(initialSlot.start);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setAppointmentDate(`${yyyy}-${mm}-${dd}`);
        
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        setSelectedSlot(`${h}:${m}`);
        
        setStatus('Scheduled');
        setReason('');
      } else {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        setAppointmentDate(`${yyyy}-${mm}-${dd}`);
        
        setPatientId('');
        setDoctorId('');
        setSelectedSlot('');
        setStatus('Scheduled');
        setReason('');
      }
    }
  }, [isOpen, appointment, initialSlot]);

  useEffect(() => {
    if (!isOpen || !doctorId || !appointmentDate) {
      setAvailableSlots([]);
      return;
    }
    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const res = await apiFetch(`/api/appointments/slots/available?doctorId=${doctorId}&date=${appointmentDate}`);
        const data = await res.json();
        setAvailableSlots(data.slots || []);
        setSlotDuration(data.slotDuration || 15);
      } catch (err) {
        addToast('error', 'Failed to load available slots');
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [isOpen, doctorId, appointmentDate]);

  const fetchDropdowns = async () => {
    setLoadingInitial(true);
    try {
      const [ptsRes, docsRes] = await Promise.all([
        apiFetch('/api/patients?pageSize=1000'),
        apiFetch('/api/users'),
      ]);
      const pts = await ptsRes.json();
      const docs = await docsRes.json();
      setPatients(Array.isArray(pts) ? pts : pts.data || []);
      const allDocs = Array.isArray(docs) ? docs : docs.data || [];
      setDoctors(allDocs.filter((u: any) => u.role === 'DOCTOR' || u.role === 'MASTER' || u.role === 'SUPER_ADMIN'));
    } catch (err) {
      addToast('error', 'Failed to load options');
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!appointmentDate || !selectedSlot) {
        addToast('error', 'Please select a date and time slot.');
        setSaving(false);
        return;
      }

      const start = new Date(`${appointmentDate}T${selectedSlot}:00`);
      const end = new Date(start.getTime() + slotDuration * 60000);

      const payload = {
        patientId,
        doctorId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status,
        reasonForVisit: reason || undefined,
      };

      const url = appointment ? `/api/appointments/${appointment.id}` : '/api/appointments';
      const method = appointment ? 'PATCH' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Operation failed' }));
        throw new Error(err.message || 'Operation failed');
      }

      addToast('success', `Appointment ${appointment ? 'updated' : 'scheduled'}!`);
      onSaved();
      onClose();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to save appointment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!appointment || !window.confirm('Are you sure you want to delete this appointment?')) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/appointments/${appointment.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      addToast('success', 'Appointment deleted');
      onSaved();
      onClose();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-md w-full p-6 mx-2 my-4">
        <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
          <h3 className="text-base font-bold text-ink-primary flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand" /> 
            {appointment ? 'Edit Appointment' : 'Schedule Appointment'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md text-ink-secondary hover:bg-surface-page">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loadingInitial ? (
          <div className="py-8 text-center text-xs text-ink-secondary">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Patient <span className="text-status-danger">*</span>
              </label>
              <select
                required
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
              >
                <option value="">Select Patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.uhid} — {p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1 flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5" /> Doctor <span className="text-status-danger">*</span>
              </label>
              <select
                required
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
              >
                <option value="">Select Doctor</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>Dr. {d.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Date
                </label>
                <input
                  type="date"
                  required
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Available Slot
                </label>
                {loadingSlots ? (
                  <div className="w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-secondary">
                    Loading slots...
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="w-full px-3 py-2 rounded-md border border-status-danger/30 text-xs bg-status-danger/5 text-status-danger">
                    No slots available
                  </div>
                ) : (
                  <select
                    required
                    value={selectedSlot}
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
                  >
                    <option value="">Select a time slot</option>
                    {availableSlots.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                    {appointment && appointment.doctorId === doctorId && !availableSlots.includes(selectedSlot) && (
                      <option value={selectedSlot}>{selectedSlot} (Current)</option>
                    )}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card font-semibold"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Checked-In">Checked-In</option>
                  <option value="Completed">Completed</option>
                  <option value="No-Show">No-Show</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Reason for Visit</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Optional notes or chief complaint..."
                className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
              />
            </div>

            <div className="pt-3 border-t border-border flex justify-between gap-2 mt-2">
              <div className="flex gap-2">
                {appointment ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium text-status-danger bg-status-danger/10 hover:bg-status-danger/20 rounded-md"
                  >
                    Delete
                  </button>
                ) : <div />}
                
                {appointment && (status === 'Checked-In' || status === 'Completed') && onLogVisit && (
                  <button
                    type="button"
                    onClick={() => onLogVisit(appointment)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors"
                  >
                    Log Clinical Visit
                  </button>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Appointment'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};