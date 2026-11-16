import React from 'react';

export interface PackPriceValue {
  unit: string;
  unitPrice: number;
  packSize: number | '';
  packLabel: string;
  sellLoose: boolean;
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Pack size and price. Stock and the bill work in single units, so the price is
 * stored per unit; entering the pack (MRP) price works it out — e.g. a strip of
 * 10 at ₹50 is ₹5 a tablet, and 5 tablets bill as ₹25.
 */
export const PackPriceFields: React.FC<{ value: PackPriceValue; onChange: (v: PackPriceValue) => void }> = ({ value, onChange }) => {
  const size = typeof value.packSize === 'number' && value.packSize > 1 ? value.packSize : null;
  const set = (patch: Partial<PackPriceValue>) => onChange({ ...value, ...patch });
  const label = value.packLabel.trim() || 'pack';

  return (
    <div className="space-y-3 rounded-md border border-border p-3 bg-surface-page/60">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-ink-secondary mb-1">{value.unit}s per pack</span>
          <input
            type="number"
            min={1}
            value={value.packSize}
            placeholder="e.g. 10"
            onChange={(e) => set({ packSize: e.target.value === '' ? '' : Math.max(1, Math.round(Number(e.target.value))) })}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-secondary mb-1">Pack is called</span>
          <select value={value.packLabel} onChange={(e) => set({ packLabel: e.target.value })} className={inputClass}>
            {['strip', 'box', 'bottle', 'tube', 'pack', 'vial', 'sachet'].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-ink-secondary mb-1">Price per {size ? label : value.unit} (₹)</span>
          <input
            type="number"
            min={0}
            step="any"
            value={size ? round2(value.unitPrice * size) : value.unitPrice}
            onChange={(e) => {
              const v = Math.max(0, Number(e.target.value) || 0);
              set({ unitPrice: size ? v / size : v });
            }}
            className={inputClass}
          />
        </label>
        <div className="block">
          <span className="block text-xs font-medium text-ink-secondary mb-1">Price per {value.unit}</span>
          <p className="px-3 py-2 text-xs font-mono text-ink-primary">₹{round2(value.unitPrice).toFixed(2)}</p>
        </div>
      </div>

      {size && (
        <label className="flex items-start gap-2 text-xs text-ink-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={value.sellLoose}
            onChange={(e) => set({ sellLoose: e.target.checked })}
            className="mt-0.5 rounded text-brand focus:ring-brand"
          />
          <span>
            <span className="font-medium text-ink-primary">Can sell loose</span> — give single {value.unit}s from a {label} (e.g. 5 of 10).
            Turn off for tubes, bottles and vials that can't be split.
          </span>
        </label>
      )}
    </div>
  );
};
