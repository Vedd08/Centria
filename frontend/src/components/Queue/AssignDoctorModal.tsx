import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { UserPlus, X, AlertCircle } from 'lucide-react';
import { QueueEntry } from './types';

interface DoctorOption {
  id: string;
  name: string;
  departmentId?: string | null;
}

interface AssignDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssigned: () => void;
  entry: QueueEntry | null;
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

export const AssignDoctorModal: React.FC<AssignDoctorModalProps> = ({ isOpen, onClose, onAssigned, entry }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await apiFetch('/api/users?role=DOCTOR,MASTER');
        const data = await res.json();
        setDoctors(Array.isArray(data) ? data : data.data || []);
      } catch {
        // Non-fatal
      }
    })();
  }, [isOpen, apiFetch]);

  useEffect(() => {
    if (isOpen && entry) {
      setDoctorId(entry.doctor?.id || '');
    }
  }, [isOpen, entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;
    
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/queue/${entry.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: entry.status,
          doctorId: doctorId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to assign doctor');
      
      addToast('success', doctorId ? 'Doctor assigned successfully' : 'Doctor unassigned');
      onAssigned();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to assign doctor');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !entry) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-sm w-full my-8">
        <div className="bg-brand px-6 py-5 text-white flex items-center justify-between rounded-t-[10px]">
          <div className="flex items-center gap-3">
            <UserPlus className="w-5 h-5" />
            <div>
              <h3 className="text-base font-semibold">Assign Doctor</h3>
              <p className="text-xs text-white/80">For {entry.patient?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Select Doctor
            </label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className={inputClass}
            >
              <option value="">Unassigned / Any available doctor</option>
              {doctors
                .filter((d) => !entry.departmentId || !d.departmentId || d.departmentId === entry.departmentId)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
            {entry.departmentId && (
              <p className="text-[10px] text-ink-secondary/70 mt-1">
                Showing doctors in this token's department.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded-md cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
