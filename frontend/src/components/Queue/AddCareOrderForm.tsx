import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Plus, X } from 'lucide-react';
import { ORDER_TYPE_LABEL } from './types';

interface MedicineOption {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  unitPrice: number;
  isActive: boolean;
}

interface TreatmentOption {
  id: string;
  name: string;
}

interface AddCareOrderFormProps {
  queueId: string;
  onOrderAdded: () => void;
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

const ROUTES = ['Oral', 'IV', 'IM', 'Subcutaneous', 'Topical', 'Inhalation'];

/** Doctor's order entry — one line per medicine, injection or treatment. */
export const AddCareOrderForm: React.FC<AddCareOrderFormProps> = ({ queueId, onOrderAdded }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [orderType, setOrderType] = useState('MEDICINE');
  const [medicines, setMedicines] = useState<MedicineOption[]>([]);
  const [treatments, setTreatments] = useState<TreatmentOption[]>([]);
  const [medicineId, setMedicineId] = useState('');
  const [treatmentId, setTreatmentId] = useState('');
  const [description, setDescription] = useState('');
  const [dosage, setDosage] = useState('');
  const [route, setRoute] = useState('Oral');
  const [frequency, setFrequency] = useState('');
  const [instructions, setInstructions] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const isStockBacked = orderType === 'MEDICINE' || orderType === 'INJECTION';

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [medRes, trtRes] = await Promise.all([apiFetch('/api/medicines'), apiFetch('/api/treatments')]);
        const medData = await medRes.json();
        const trtData = await trtRes.json();
        const meds: MedicineOption[] = Array.isArray(medData) ? medData : medData.data || [];
        setMedicines(meds.filter((m) => m.isActive));
        setTreatments(Array.isArray(trtData) ? trtData : trtData.data || []);
      } catch {
        addToast('error', 'Failed to load the medicine/treatment catalogue');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = () => {
    setMedicineId('');
    setTreatmentId('');
    setDescription('');
    setDosage('');
    setFrequency('');
    setInstructions('');
    setQuantity('1');
  };

  // Not a <form>: this sits inside the doctor's assessment form, and a nested form never
  // submits — clicking "Add Order" silently did nothing. Validation is done here instead.
  const handleSubmit = async () => {
    if (submitting) return;
    if (isStockBacked && !medicineId) {
      addToast('error', 'Select a medicine from pharmacy stock');
      return;
    }
    if (orderType !== 'TREATMENT' && !isStockBacked && !description.trim()) {
      addToast('error', 'Describe what should be done');
      return;
    }
    if (orderType === 'TREATMENT' && !treatmentId && !description.trim()) {
      addToast('error', 'Select a treatment or describe it');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/care-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueId,
          orderType,
          medicineId: isStockBacked ? medicineId : undefined,
          treatmentId: orderType === 'TREATMENT' ? treatmentId || undefined : undefined,
          description: description.trim() || undefined,
          dosage: dosage.trim() || undefined,
          route: isStockBacked ? route : undefined,
          frequency: frequency.trim() || undefined,
          instructions: instructions.trim() || undefined,
          quantity: Number(quantity) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add order');
      addToast('success', 'Order added to the patient');
      reset();
      setOpen(false);
      onOrderAdded();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to add order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Order</span>
      </button>
    );
  }

  return (
    <div
      className="bg-surface-page p-4 rounded-lg border border-border space-y-3 w-full"
      onKeyDown={(e) => {
        // Enter in a field adds the order instead of submitting the surrounding assessment.
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault();
          handleSubmit();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-primary">New care order</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="p-1 rounded text-ink-secondary hover:text-ink-primary cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-ink-secondary mb-1">
            Type <span className="text-status-danger">*</span>
          </label>
          <select value={orderType} onChange={(e) => setOrderType(e.target.value)} className={inputClass}>
            {Object.entries(ORDER_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {isStockBacked ? (
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Medicine <span className="text-status-danger">*</span>
            </label>
            <select value={medicineId} onChange={(e) => setMedicineId(e.target.value)} className={inputClass}>
              <option value="">Select from pharmacy stock</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.stockQty} {m.unit} in stock)
                </option>
              ))}
            </select>
          </div>
        ) : orderType === 'TREATMENT' ? (
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Treatment</label>
            <select value={treatmentId} onChange={(e) => setTreatmentId(e.target.value)} className={inputClass}>
              <option value="">Select treatment (or describe below)</option>
              {treatments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Description <span className="text-status-danger">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should be done"
              className={inputClass}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-ink-secondary mb-1">Quantity</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-secondary mb-1">Dosage</label>
          <input
            type="text"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="500mg"
            className={inputClass}
          />
        </div>
        {isStockBacked && (
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Route</label>
            <select value={route} onChange={(e) => setRoute(e.target.value)} className={inputClass}>
              {ROUTES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-ink-secondary mb-1">Frequency</label>
          <input
            type="text"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            placeholder="1-0-1"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-secondary mb-1">Instructions for staff</label>
        <input
          type="text"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g. After food, monitor for reaction"
          className={inputClass}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3.5 py-1.5 text-xs font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded-md cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="px-3.5 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
        >
          {submitting ? 'Adding...' : 'Add Order'}
        </button>
      </div>
    </div>
  );
};
