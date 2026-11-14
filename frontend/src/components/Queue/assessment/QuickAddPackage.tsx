import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

const inputClass = 'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

/** Inline form for a new multi-sitting package, pre-linked to the chosen procedure. */
export const QuickAddPackage: React.FC<{
  treatmentId: string;
  treatmentName?: string;
  onCreated: (pkg: any) => void;
  onCancel: () => void;
}> = ({ treatmentId, treatmentName, onCreated, onCancel }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [name, setName] = useState(treatmentName ? `${treatmentName} package` : '');
  const [sittings, setSittings] = useState('6');
  const [price, setPrice] = useState('');
  const [gapDays, setGapDays] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return setError('Enter the package name');
    if (!Number(sittings) || Number(sittings) < 1) return setError('Sittings must be at least 1');
    if (price === '' || Number(price) < 0) return setError('Enter the package price');
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch('/api/packages/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          totalSittings: Math.floor(Number(sittings)),
          price: Number(price),
          sittingGapDays: gapDays ? Math.floor(Number(gapDays)) : undefined,
          treatmentId: treatmentId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        throw new Error(msg || 'Could not create the package');
      }
      addToast('success', `Package "${data.name}" created`);
      onCreated(data);
    } catch (err: any) {
      setError(err.message || 'Could not create the package');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 p-3 rounded-lg border border-brand/30 bg-brand-soft/50 space-y-2.5">
      <p className="text-[11px] font-semibold text-brand-deep">
        New package{treatmentName ? ` for ${treatmentName}` : ''}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Package name *"
          className={`${inputClass} col-span-2`}
        />
        <input type="number" min="1" value={sittings} onChange={(e) => setSittings(e.target.value)} placeholder="Sittings *" title="Total sittings" className={inputClass} />
        <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (₹) *" className={inputClass} />
        <input
          type="number"
          min="1"
          value={gapDays}
          onChange={(e) => setGapDays(e.target.value)}
          placeholder="Days between sittings"
          className={`${inputClass} col-span-2`}
        />
      </div>
      {error && <p className="text-[11px] text-status-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-[11px] font-medium text-ink-secondary hover:text-ink-primary rounded-md cursor-pointer">
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 text-[11px] font-semibold text-white bg-brand hover:bg-brand-deep rounded-md cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create package'}
        </button>
      </div>
    </div>
  );
};
