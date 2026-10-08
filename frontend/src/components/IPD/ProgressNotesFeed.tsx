import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { StatusBadge } from '../common/StatusBadge';
import { CONDITION_LABEL, conditionVariant } from './conditionStatus';
import { Activity, Plus, X, HeartPulse, Thermometer, Wind, Gauge } from 'lucide-react';

interface ProgressNote {
  id: string;
  noteType: string;
  note: string;
  status?: string;
  bloodPressure?: string;
  pulse?: number;
  temperature?: number;
  spo2?: number;
  recordedAt: string;
  author?: { name: string; role: string };
}

interface ProgressNotesFeedProps {
  admissionId: string;
  isActiveAdmission: boolean;
  /** Called after a note that also updated the patient's current status. */
  onStatusChanged?: () => void;
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

export const ProgressNotesFeed: React.FC<ProgressNotesFeedProps> = ({ admissionId, isActiveAdmission, onStatusChanged }) => {
  const { apiFetch, hasRole } = useAuth();
  const { addToast } = useToast();
  const [notes, setNotes] = useState<ProgressNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [pulse, setPulse] = useState('');
  const [temperature, setTemperature] = useState('');
  const [spo2, setSpo2] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canAddNote = hasRole('DOCTOR', 'NURSE');

  const fetchNotes = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admissions/${admissionId}/progress-notes`, { signal });
      if (!res.ok) throw new Error('Failed to load progress notes');
      const result = await res.json();
      if (signal?.aborted) return;
      setNotes(Array.isArray(result) ? result : result.data || []);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addToast('error', err.message || 'Failed to load progress notes');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchNotes(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId]);

  const resetForm = () => {
    setNote('');
    setStatus('');
    setBloodPressure('');
    setPulse('');
    setTemperature('');
    setSpo2('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/admissions/${admissionId}/progress-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: note.trim(),
          status: status || undefined,
          bloodPressure: bloodPressure.trim() || undefined,
          pulse: pulse ? Number(pulse) : undefined,
          temperature: temperature ? Number(temperature) : undefined,
          spo2: spo2 ? Number(spo2) : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to save note' }));
        throw new Error(err.message || 'Failed to save note');
      }
      addToast('success', status ? `Progress note added — condition set to ${CONDITION_LABEL[status] || status}` : 'Progress note added');
      const didChangeStatus = !!status;
      resetForm();
      setShowForm(false);
      fetchNotes();
      if (didChangeStatus) onStatusChanged?.();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to save note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-secondary">
          Clinical progress and nursing observations, newest first — the record of how this patient is recovering.
        </p>
        {canAddNote && isActiveAdmission && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Note</span>
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface-page p-4 rounded-lg border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-primary">New progress note</span>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="p-1 rounded text-ink-secondary hover:text-ink-primary cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Note <span className="text-status-danger">*</span>
            </label>
            <textarea
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Clinical observation, response to treatment, plan..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Update Patient Condition</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="">No change</option>
              {Object.entries(CONDITION_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-ink-secondary/70 mt-1">
              Sets the patient's current condition shown on the IPD board, alongside this note.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">BP</label>
              <input
                type="text"
                value={bloodPressure}
                onChange={(e) => setBloodPressure(e.target.value)}
                placeholder="120/80"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Pulse (bpm)</label>
              <input type="number" value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="78" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                placeholder="36.8"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">SpO2 (%)</label>
              <input type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)} placeholder="98" className={inputClass} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="px-3.5 py-1.5 text-xs font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded-md cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingSkeleton rows={2} />
      ) : notes.length === 0 ? (
        <div className="text-ink-secondary text-xs py-8 text-center bg-surface-page rounded-lg border border-border">
          No progress notes recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="bg-surface-page p-3 rounded-lg border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-primary flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-brand" />
                  {n.author?.name || 'Unknown author'}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                    n.noteType === 'DOCTOR'
                      ? 'bg-brand-soft text-brand-deep border-brand/20'
                      : 'bg-surface-card text-ink-secondary border-border'
                  }`}
                >
                  {n.noteType === 'DOCTOR' ? 'Doctor' : 'Nurse'}
                </span>
              </div>

              {n.status && (
                <StatusBadge label={`Condition set to ${CONDITION_LABEL[n.status] || n.status}`} variant={conditionVariant(n.status)} />
              )}

              <p className="text-xs text-ink-primary leading-relaxed">{n.note}</p>

              {(n.bloodPressure || n.pulse || n.temperature || n.spo2) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {n.bloodPressure && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-surface-card border border-border text-ink-secondary">
                      <Gauge className="w-3 h-3" /> {n.bloodPressure}
                    </span>
                  )}
                  {n.pulse != null && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-surface-card border border-border text-ink-secondary">
                      <HeartPulse className="w-3 h-3" /> {n.pulse} bpm
                    </span>
                  )}
                  {n.temperature != null && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-surface-card border border-border text-ink-secondary">
                      <Thermometer className="w-3 h-3" /> {n.temperature}°C
                    </span>
                  )}
                  {n.spo2 != null && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-surface-card border border-border text-ink-secondary">
                      <Wind className="w-3 h-3" /> {n.spo2}%
                    </span>
                  )}
                </div>
              )}

              <p className="text-[10px] text-ink-secondary/70">{new Date(n.recordedAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
