import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../common/StatusBadge';
import { BedDouble, X, AlertCircle } from 'lucide-react';

const bedStatusVariant = (status: string) =>
  status === 'AVAILABLE' ? 'success' : status === 'OCCUPIED' ? 'warning' : 'neutral';

interface PatientOption {
  id: string;
  uhid: string;
  name: string;
  phone: string;
}

interface DoctorOption {
  id: string;
  name: string;
}

interface WardOption {
  id: string;
  name: string;
}

interface BedOption {
  id: string;
  bedNumber: string;
  status: string;
}

interface AdmitPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdmitted: () => void;
  /** Pre-fills and locks the patient when admitting from a doctor's admission recommendation. */
  prefill?: {
    queueId: string;
    patient: PatientOption;
    doctorId?: string;
    reason?: string;
  };
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

export const AdmitPatientModal: React.FC<AdmitPatientModalProps> = ({ isOpen, onClose, onAdmitted, prefill }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();

  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientId, setPatientId] = useState('');
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [wards, setWards] = useState<WardOption[]>([]);
  const [wardId, setWardId] = useState('');
  const [beds, setBeds] = useState<BedOption[]>([]);
  const [bedId, setBedId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load the pickers that don't depend on other selections.
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const [doctorsRes, wardsRes] = await Promise.all([
          apiFetch('/api/users?role=DOCTOR,MASTER'),
          apiFetch('/api/wards'),
        ]);
        const doctorsData = await doctorsRes.json();
        const wardsData = await wardsRes.json();
        setDoctors(Array.isArray(doctorsData) ? doctorsData : doctorsData.data || []);
        setWards(Array.isArray(wardsData) ? wardsData : wardsData.data || []);
      } catch {
        setError('Failed to load doctors or wards');
      }
    })();
  }, [isOpen, apiFetch]);

  // Carries the doctor's recommendation into the form once, when the modal opens.
  useEffect(() => {
    if (!isOpen || !prefill) return;
    setPatientId(prefill.patient.id);
    setDoctorId(prefill.doctorId || '');
    setReason(prefill.reason || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prefill?.queueId]);

  // Patient typeahead — not needed when the patient is already locked in from a prefill.
  useEffect(() => {
    if (!isOpen || prefill) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ pageSize: '10' });
        if (patientSearch.trim()) params.set('search', patientSearch.trim());
        const res = await apiFetch(`/api/patients?${params}`, { signal: controller.signal });
        const result = await res.json();
        setPatients(Array.isArray(result) ? result : result.data || []);
      } catch (err: any) {
        if (err.name !== 'AbortError') setError('Failed to search patients');
      }
    }, patientSearch.trim() ? 300 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [patientSearch, isOpen, apiFetch]);

  const loadBeds = async (selectedWardId: string) => {
    setBedId('');
    if (!selectedWardId) {
      setBeds([]);
      return;
    }
    try {
      // Fetch every bed (not just available ones) so the picker can show occupied/
      // maintenance beds for context instead of just silently omitting them.
      const res = await apiFetch(`/api/beds?wardId=${selectedWardId}`);
      const result = await res.json();
      setBeds(Array.isArray(result) ? result : result.data || []);
    } catch {
      setError('Failed to load beds for this ward');
    }
  };

  const resetForm = () => {
    setPatientSearch('');
    setPatientId('');
    setDoctorId('');
    setWardId('');
    setBeds([]);
    setBedId('');
    setReason('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!bedId) {
      setError('Select an available bed');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          doctorId,
          bedId,
          reasonForAdmission: reason.trim(),
          queueId: prefill?.queueId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to admit patient' }));
        // A 409 means the bed was taken between loading the list and submitting —
        // refresh the bed list in place so the user can pick another without losing
        // the rest of the form.
        if (res.status === 409) {
          await loadBeds(wardId);
        }
        throw new Error(err.message || 'Failed to admit patient');
      }
      addToast('success', 'Patient admitted');
      resetForm();
      onAdmitted();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to admit patient');
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
            <BedDouble className="w-5 h-5" />
            <div>
              <h3 className="text-base font-semibold">Admit Patient</h3>
              <p className="text-xs text-white/80">Assign an inpatient bed and attending doctor</p>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm();
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
            {prefill ? (
              <div className="p-2.5 rounded-md border border-border bg-surface-page text-xs">
                <span className="font-semibold text-ink-primary">{prefill.patient.name}</span>
                <span className="text-ink-secondary font-mono ml-2">({prefill.patient.uhid})</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search by name, UHID or phone..."
                  className={`${inputClass} mb-2`}
                />
                <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className={inputClass}>
                  <option value="">Select a patient</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.uhid})
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Attending Doctor <span className="text-status-danger">*</span>
              </label>
              <select required value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputClass}>
                <option value="">Select doctor</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Ward <span className="text-status-danger">*</span>
              </label>
              <select
                required
                value={wardId}
                onChange={(e) => {
                  setWardId(e.target.value);
                  loadBeds(e.target.value);
                }}
                className={inputClass}
              >
                <option value="">Select ward</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Bed <span className="text-status-danger">*</span>
            </label>
            {!wardId ? (
              <p className="text-xs text-ink-secondary p-2.5 rounded-md border border-dashed border-border">
                Choose a ward first
              </p>
            ) : beds.length === 0 ? (
              <p className="text-xs text-status-warning p-2.5 rounded-md border border-dashed border-status-warning/30">
                This ward has no beds set up yet.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {beds.map((b) => {
                    const selectable = b.status === 'AVAILABLE';
                    const selected = bedId === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        disabled={!selectable}
                        aria-pressed={selected}
                        onClick={() => setBedId(b.id)}
                        title={!selectable ? `${b.bedNumber} is ${b.status.toLowerCase()}` : b.bedNumber}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-center transition-colors cursor-pointer disabled:cursor-not-allowed ${
                          selected
                            ? 'border-brand bg-brand text-white shadow-xs'
                            : selectable
                              ? 'border-border bg-surface-card hover:bg-surface-page hover:border-brand/40'
                              : 'border-border bg-surface-page/60 opacity-50'
                        }`}
                      >
                        <BedDouble className={`w-4 h-4 ${selected ? 'text-white' : 'text-ink-secondary/70'}`} />
                        <span className={`text-xs font-semibold font-mono ${selected ? 'text-white' : 'text-ink-primary'}`}>
                          {b.bedNumber}
                        </span>
                        {!selected && <StatusBadge label={b.status} variant={bedStatusVariant(b.status)} />}
                      </button>
                    );
                  })}
                </div>
                {beds.every((b) => b.status !== 'AVAILABLE') && (
                  <p className="text-[11px] text-status-warning mt-2">No available beds in this ward right now.</p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Reason for Admission <span className="text-status-danger">*</span>
            </label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Presenting complaint / clinical reason for inpatient admission"
              className={inputClass}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                resetForm();
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
              {submitting ? 'Admitting...' : 'Admit Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
