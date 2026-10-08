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
        setSchedules(data.map((s: any) => ({
          dayOfWeek: String(s.dayOfWeek),
          startTime: s.startTime,
          endTime: s.endTime,
          slotDurationInMinutes: s.slotDurationInMinutes,
        })));
      }
    } catch (err) {
      addToast('error', 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSchedules([...schedules, { dayOfWeek: '1', startTime: '09:00', endTime: '17:00', slotDurationInMinutes: 15 }]);
  };

  const handleRemove = (index: number) => {
    const next = [...schedules];
    next.splice(index, 1);
    setSchedules(next);
  };

  const handleChange = (index: number, field: keyof ScheduleInput, value: any) => {
    const next = [...schedules];
    next[index] = { ...next[index], [field]: value };
    setSchedules(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/appointments/schedule/${doctorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules }),
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
                <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-surface-page p-3 rounded-lg border border-border">
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
                    <label className="block text-[10px] font-bold text-ink-secondary uppercase mb-1">Duration (min)</label>
                    <input
                      type="number"
                      min={5}
                      step={5}
                      value={s.slotDurationInMinutes}
                      onChange={e => handleChange(i, 'slotDurationInMinutes', Number(e.target.value))}
                      className="w-full px-2 py-1.5 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
                    />
                  </div>
                  <div className="mt-4 sm:mt-0 self-end sm:self-auto pb-0 sm:pb-0.5">
                    <button onClick={() => handleRemove(i)} className="p-1.5 rounded text-status-danger hover:bg-status-danger/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
