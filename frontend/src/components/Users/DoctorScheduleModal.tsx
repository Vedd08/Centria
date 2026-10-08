import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { X, Calendar, Plus, Trash2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  doctorName: string;
}

interface ScheduleInput {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDurationInMinutes: number;
  patientsPerSession?: number;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DoctorScheduleModal: React.FC<Props> = ({ isOpen, onClose, doctorId, doctorName }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  
  const [schedules, setSchedules] = useState<ScheduleInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && doctorId) {
      fetchSchedules();
    }
  }, [isOpen, doctorId]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/appointments/schedule/${doctorId}`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.map((s: any) => {
          const startMins = Number(s.startTime.split(':')[0]) * 60 + Number(s.startTime.split(':')[1]);
          const endMins = Number(s.endTime.split(':')[0]) * 60 + Number(s.endTime.split(':')[1]);
          const total = endMins - startMins;
          const patients = Math.floor(total / s.slotDurationInMinutes);
          return {
            dayOfWeek: String(s.dayOfWeek),
            startTime: s.startTime,
            endTime: s.endTime,
            slotDurationInMinutes: s.slotDurationInMinutes,
            patientsPerSession: patients || 0,
          };
        }));
      }
    } catch (err) {
      addToast('error', 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSchedules([...schedules, { dayOfWeek: '1', startTime: '09:00', endTime: '17:00', slotDurationInMinutes: 15, patientsPerSession: 32 }]);
  };

  const handleRemove = (index: number) => {
    const next = [...schedules];
    next.splice(index, 1);
    setSchedules(next);
  };

  const handleChange = (index: number, field: keyof ScheduleInput, value: any) => {
    const next = [...schedules];
    next[index] = { ...next[index], [field]: value };
    
    const s = next[index];
    if (s.startTime && s.endTime && (s.patientsPerSession || 0) > 0) {
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      const total = (eh * 60 + em) - (sh * 60 + sm);
      if (total > 0) {
        s.slotDurationInMinutes = Math.ceil(total / s.patientsPerSession!);
      }
    }
    
    setSchedules(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = schedules.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        slotDurationInMinutes: s.slotDurationInMinutes
      }));
      const res = await apiFetch(`/api/appointments/schedule/${doctorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules: payload }),
      });
      if (!res.ok) throw new Error('Failed to save schedule');
      addToast('success', 'Schedule saved successfully');
      onClose();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-2xl w-full mx-2 sm:mx-0 my-4 sm:my-8 overflow-hidden">
        
        <div className="bg-brand-deep px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Calendar className="w-5 h-5 text-brand-soft" />
            <span>Manage Schedule for Dr. {doctorName}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-ink-primary">
          <p className="text-xs text-ink-secondary">
            Configure the working hours and appointment slot lengths for this doctor. The appointment booking screen will automatically generate slots within these ranges.
          </p>

          {loading ? (
            <div className="py-8 text-center text-xs text-ink-secondary">Loading schedule...</div>
          ) : (
            <div className="space-y-3">
              {schedules.map((s, i) => (
                <div key={i} className="bg-surface-page p-3 rounded-lg border border-border flex flex-col gap-2">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <div className="flex-1 w-full sm:w-auto">
                      <label className="block text-[10px] font-bold text-ink-secondary uppercase mb-1">Day</label>
                      <select
                        value={s.dayOfWeek}
                        onChange={e => handleChange(i, 'dayOfWeek', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
                      >
                        {DAYS.map((d, idx) => (
                          <option key={idx} value={String(idx)}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 w-full sm:w-auto">
                      <label className="block text-[10px] font-bold text-ink-secondary uppercase mb-1">Start Time</label>
                      <input
                        type="time"
                        value={s.startTime}
                        onChange={e => handleChange(i, 'startTime', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
                      />
                    </div>
                    <div className="flex-1 w-full sm:w-auto">
                      <label className="block text-[10px] font-bold text-ink-secondary uppercase mb-1">End Time</label>
                      <input
                        type="time"
                        value={s.endTime}
                        onChange={e => handleChange(i, 'endTime', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
                      />
                    </div>
                    <div className="flex-1 w-full sm:w-auto">
                      <label className="block text-[10px] font-bold text-ink-secondary uppercase mb-1">Patients</label>
                      <input
                        type="number"
                        min={1}
                        value={s.patientsPerSession || ''}
                        onChange={e => handleChange(i, 'patientsPerSession', Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
                      />
                    </div>
                    <div className="mt-4 sm:mt-0 self-end sm:self-auto pb-0 sm:pb-0.5">
                      <button onClick={() => handleRemove(i)} className="p-1.5 rounded text-status-danger hover:bg-status-danger/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {(() => {
                    if (!s.startTime || !s.endTime || !s.patientsPerSession) return null;
                    const [sh, sm] = s.startTime.split(':').map(Number);
                    const [eh, em] = s.endTime.split(':').map(Number);
                    const total = (eh * 60 + em) - (sh * 60 + sm);
                    if (total <= 0) {
                      return <div className="text-status-danger text-[11px] font-medium mt-1">End time must be after start time</div>;
                    }
                    
                    // Check overlaps
                    const sameDay = schedules.filter((x, idx) => x.dayOfWeek === s.dayOfWeek && idx !== i && x.startTime && x.endTime);
                    const overlap = sameDay.some(x => {
                      const [xsh, xsm] = x.startTime.split(':').map(Number);
                      const [xeh, xem] = x.endTime.split(':').map(Number);
                      const xtotalStart = xsh * 60 + xsm;
                      const xtotalEnd = xeh * 60 + xem;
                      const sTotalStart = sh * 60 + sm;
                      const sTotalEnd = eh * 60 + em;
                      return (sTotalStart < xtotalEnd && sTotalEnd > xtotalStart);
                    });
                    
                    if (overlap) {
                      return <div className="text-status-danger text-[11px] font-medium mt-1">This session overlaps with another on the same day</div>;
                    }

                    const slotDuration = s.slotDurationInMinutes;
                    const fits = Math.floor(total / slotDuration);
                    const requested = s.patientsPerSession;
                    
                    const formatTime = (time: string) => {
                      const [h, m] = time.split(':').map(Number);
                      const ampm = h >= 12 ? 'PM' : 'AM';
                      const hr = h % 12 || 12;
                      return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
                    };
                    
                    if (fits < requested) {
                      return <div className="text-[11px] font-medium text-ink-secondary mt-1 bg-surface-card p-1.5 rounded inline-block self-start">
                        {formatTime(s.startTime)} – {formatTime(s.endTime)} · {slotDuration} min each · <span className="text-status-danger">{fits} patients fit — widen the window for {requested}</span>
                      </div>;
                    }
                    
                    return <div className="text-[11px] font-medium text-ink-secondary mt-1 bg-surface-card p-1.5 rounded inline-block self-start">
                      {formatTime(s.startTime)} – {formatTime(s.endTime)} · {requested} patients → {slotDuration} min each · {fits} slots
                    </div>;
                  })()}
                </div>
              ))}
              
              {schedules.length === 0 && (
                <div className="text-center py-6 text-xs text-ink-secondary border border-dashed border-border rounded-lg">
                  No schedules configured for this doctor.
                </div>
              )}

              <button
                type="button"
                onClick={handleAdd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand hover:text-brand-deep hover:bg-brand-soft rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Schedule Slot
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-border flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
