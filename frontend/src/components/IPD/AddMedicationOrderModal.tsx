import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Pill, X, AlertCircle } from 'lucide-react';

interface MedicineOption {
  id: string;
  name: string;
  unit: string;
  isActive: boolean;
}

interface AddMedicationOrderModalProps {
  isOpen: boolean;
  admissionId: string;
  onClose: () => void;
  onOrderCreated: () => void;
}

const ROUTES = ['Oral', 'IV', 'IM', 'Subcutaneous', 'Topical', 'Inhalation'];

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

export const AddMedicationOrderModal: React.FC<AddMedicationOrderModalProps> = ({
  isOpen,
  admissionId,
  onClose,
  onOrderCreated,
}) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [medicines, setMedicines] = useState<MedicineOption[]>([]);
  const [medicineId, setMedicineId] = useState('');
  const [dosage, setDosage] = useState('');
  const [route, setRoute] = useState('Oral');
  const [frequency, setFrequency] = useState('');
  const [instructions, setInstructions] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await apiFetch('/api/medicines');
        const result = await res.json();
        const items: MedicineOption[] = Array.isArray(result) ? result : result.data || [];
        setMedicines(items.filter((m) => m.isActive));
      } catch {
        setError('Failed to load the medicine catalog');
      }
    })();
  }, [isOpen, apiFetch]);

  const resetForm = () => {
    setMedicineId('');
    setDosage('');
    setRoute('Oral');
    setFrequency('');
    setInstructions('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/medication-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admissionId,
          medicineId,
          dosage: dosage.trim(),
          route,
          frequency: frequency.trim(),
          instructions: instructions.trim() || undefined,
          startDate,
          endDate: endDate || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to create medication order' }));
        throw new Error(err.message || 'Failed to create medication order');
      }
      addToast('success', 'Medication order added to the chart');
      resetForm();
      onOrderCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create medication order');
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
            <Pill className="w-5 h-5" />
            <div>
              <h3 className="text-base font-semibold">New Medication Order</h3>
              <p className="text-xs text-white/80">Added to this patient's inpatient drug chart</p>
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
              Medicine <span className="text-status-danger">*</span>
            </label>
            <select required value={medicineId} onChange={(e) => setMedicineId(e.target.value)} className={inputClass}>
              <option value="">Select from pharmacy catalog</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Dosage <span className="text-status-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="e.g. 500mg / 1 tablet"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Route <span className="text-status-danger">*</span>
              </label>
              <select required value={route} onChange={(e) => setRoute(e.target.value)} className={inputClass}>
                {ROUTES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Frequency <span className="text-status-danger">*</span>
            </label>
            <input
              type="text"
              required
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="e.g. 1-0-1 or Q6H"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Start Date <span className="text-status-danger">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="e.g. After food, monitor for rash"
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
              {submitting ? 'Adding...' : 'Add to Chart'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
