import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export interface ProcedureOption {
  id: string;
  name: string;
  price?: number | string;
}

interface Props {
  onCreated: (procedure: ProcedureOption) => void;
  onCancel: () => void;
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

/**
 * Adds a procedure to the clinic's catalogue without leaving the current screen —
 * for when the doctor is doing something that isn't listed yet. Rendered as a div,
 * not a form, because it sits inside other forms.
 */
export const QuickAddProcedure: React.FC<Props> = ({ onCreated, onCancel }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [gst, setGst] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setError('Enter the procedure name');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch('/api/treatments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          price: price ? Number(price) : undefined,
          isGstTaxable: gst,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        throw new Error(msg || 'Could not add the procedure');
      }
      addToast('success', `${data.name} added to procedures`);
      onCreated(data);
    } catch (err: any) {
      setError(err.message || 'Could not add the procedure');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 rounded-lg border border-brand/30 bg-brand-soft/50 space-y-2.5">
      <p className="text-[11px] font-semibold text-brand-deep">New procedure</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
          }}
          placeholder="Procedure name * (e.g. Chemical Peel)"
          className={`${inputClass} sm:col-span-2`}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price (₹)"
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2 text-[11px] text-ink-secondary cursor-pointer select-none">
        <input type="checkbox" checked={gst} onChange={(e) => setGst(e.target.checked)} className="rounded border-border text-brand" />
        GST applies to this procedure
      </label>
      {error && <p className="text-[11px] text-status-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-[11px] font-medium text-ink-secondary hover:text-ink-primary rounded-md cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 text-[11px] font-semibold text-white bg-brand hover:bg-brand-deep rounded-md cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Adding...' : 'Add procedure'}
        </button>
      </div>
    </div>
  );
};
