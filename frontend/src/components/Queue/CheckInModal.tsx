import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { UserPlus, X, AlertCircle, Repeat } from 'lucide-react';
import { PatientRegistrationModal } from '../Patients/PatientRegistrationModal';

interface PatientOption {
  id: string;
  name: string;
  phone: string;
  uhid: string;
}

interface DoctorOption {
  id: string;
  name: string;
  departmentId?: string | null;
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckedIn: () => void;
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

export const CheckInModal: React.FC<CheckInModalProps> = ({ isOpen, onClose, onCheckedIn }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientId, setPatientId] = useState('');
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [complaint, setComplaint] = useState('');
  const [careType, setCareType] = useState<'OPD' | 'IPD'>('OPD');
  const [priorVisits, setPriorVisits] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const deptRes = await apiFetch('/api/departments?activeOnly=true');
        if (deptRes.ok) setDepartments(await deptRes.json());
        const res = await apiFetch('/api/users?role=DOCTOR,MASTER');
        const data = await res.json();
        setDoctors(Array.isArray(data) ? data : data.data || []);
      } catch {
        // Non-fatal — reception can leave the doctor unassigned.
      }
    })();
  }, [isOpen, apiFetch]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ pageSize: '15' });
        if (search.trim()) params.set('search', search.trim());
        const res = await apiFetch(`/api/patients?${params}`, { signal: controller.signal });
        const result = await res.json();
        setPatients(Array.isArray(result) ? result : result.data || []);
      } catch (err: any) {
        if (err.name !== 'AbortError') setError('Failed to search patients');
      }
    }, search.trim() ? 300 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, isOpen, apiFetch]);

  // Look up whether this is a returning patient, so reception can tell the doctor.
  useEffect(() => {
    if (!patientId) {
      setPriorVisits(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/visits?patientId=${patientId}&pageSize=1`);
        const result = await res.json();
        if (!cancelled) setPriorVisits(result.total ?? 0);
      } catch {
        if (!cancelled) setPriorVisits(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, apiFetch]);

  const reset = () => {
    setSearch('');
    setPatientId('');
    setDoctorId('');
    setComplaint('');
    setDepartmentId('');
    setCareType('OPD');
    setPriorVisits(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          departmentId: departmentId || undefined,
          careType,
          complaint: complaint.trim() || undefined,
          doctorId: doctorId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to check in patient');
      addToast('success', `Checked in — token ${data.tokenNumber}`);
      reset();
      onCheckedIn();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to check in patient');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-lg w-full my-8 max-h-[90vh] overflow-y-auto">
        <div className="bg-brand px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserPlus className="w-5 h-5" />
            <div>
              <h3 className="text-base font-semibold">Check In Patient</h3>
              <p className="text-xs text-white/80">Adds the patient to today's queue for the doctor</p>
            </div>
          </div>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="p-1 rounded hover:bg-white/10 cursor-pointer"
          >
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
              Patient <span className="text-status-danger">*</span>
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or mobile..."
              className={`${inputClass} mb-2`}
            />
            <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className={inputClass}>
              <option value="">Select a patient</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.phone})
                </option>
              ))}
            </select>

            {/* Walk-ins are often not on file yet — register without leaving check-in. */}
            {search.trim().length > 1 && patients.length === 0 && (
              <div className="mt-2 p-2.5 rounded-md bg-status-warning/10 border border-status-warning/20 text-status-warning text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>No patient matches "{search.trim()}".</span>
                <button
                  type="button"
                  onClick={() => setShowRegister(true)}
                  className="underline font-medium cursor-pointer"
                >
                  Register new patient
                </button>
              </div>
            )}

            {priorVisits !== null && patientId && (
              <div
                className={`mt-2 p-2.5 rounded-md border text-xs flex items-center gap-2 ${
                  priorVisits > 0
                    ? 'bg-brand-soft border-brand/20 text-brand-deep'
                    : 'bg-surface-page border-border text-ink-secondary'
                }`}
              >
                {priorVisits > 0 ? (
                  <>
                    <Repeat className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      <strong>Regular patient</strong> — {priorVisits} previous visit{priorVisits === 1 ? '' : 's'}.
                      The doctor will see this.
                    </span>
                  </>
                ) : (
                  <span>New patient — no previous visits on record.</span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Visit Type <span className="text-status-danger">*</span>
            </label>
            <div className="flex gap-2">
              {(['OPD', 'IPD'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCareType(t)}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                    careType === t
                      ? 'bg-brand text-white border-brand shadow-xs'
                      : 'bg-surface-card text-ink-primary border-border hover:bg-surface-page'
                  }`}
                >
                  {t === 'OPD' ? 'OPD — Consultation' : 'IPD — Procedure'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-ink-secondary/70 mt-1">
              The doctor confirms or changes this during assessment.
            </p>
          </div>

          {departments.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Department</label>
              <select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setDoctorId(''); // The previous doctor may not work in the new department.
                }}
                className={inputClass}
              >
                <option value="">General / not specified</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-ink-secondary/70 mt-1">
                Each department numbers its own tokens from 1 each day.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Send to Doctor (Optional)</label>
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputClass}>
              <option value="">Any available doctor</option>
              {doctors
                .filter((d) => !departmentId || !d.departmentId || d.departmentId === departmentId)
                .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Reason for Visit / Complaint</label>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              rows={3}
              placeholder="What the patient has come in for"
              className={inputClass}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
              className="px-4 py-2 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded-md cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Checking in...' : 'Check In'}
            </button>
          </div>
        </form>
      </div>

      <PatientRegistrationModal
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        onPatientCreated={() => {
          setShowRegister(false);
          // Re-runs the search effect so the new patient appears in the picker.
          setSearch((s) => `${s} `.trim());
          addToast('success', 'Patient registered — now select them to check in');
        }}
        editPatient={null}
        showCheckInOption={false}
      />
    </div>
  );
};
