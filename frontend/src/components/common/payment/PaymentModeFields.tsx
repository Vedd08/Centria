import React from 'react';
import { Banknote, CreditCard, Landmark, Smartphone } from 'lucide-react';
import {
  PAYMENT_FIELDS,
  PAYMENT_MODES,
  PAYMENT_MODE_LABEL,
  PaymentDetailsDraft,
  PaymentField,
  PaymentMode,
} from './paymentModes';

const MODE_ICON: Record<PaymentMode, React.ElementType> = {
  CASH: Banknote,
  ONLINE: Landmark,
  CARD: CreditCard,
  UPI: Smartphone,
};

const inputClass =
  'w-full px-2.5 py-1.5 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

interface Props {
  mode: PaymentMode;
  details: PaymentDetailsDraft;
  onModeChange: (mode: PaymentMode) => void;
  onDetailsChange: (details: PaymentDetailsDraft) => void;
  disabled?: boolean;
}

/**
 * Cash / Online / Card / UPI picker plus the details that mode needs — transaction
 * ID, account, card last 4, UPI ID… Shared by every screen that takes a payment so
 * each bill prints the same details.
 */
export const PaymentModeFields: React.FC<Props> = ({ mode, details, onModeChange, onDetailsChange, disabled }) => {
  const setField = (key: PaymentField, value: string) => onDetailsChange({ ...details, [key]: value });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5">
        {PAYMENT_MODES.map((m) => {
          const Icon = MODE_ICON[m];
          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onClick={() => onModeChange(m)}
              className={`inline-flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium rounded-md border transition-colors cursor-pointer disabled:opacity-50 ${
                mode === m
                  ? 'bg-brand text-white border-brand shadow-xs'
                  : 'bg-surface-card text-ink-primary border-border hover:bg-surface-page'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {PAYMENT_MODE_LABEL[m]}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {PAYMENT_FIELDS[mode].map((f) => (
          <div key={f.key}>
            <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
              {f.label} {f.required && <span className="text-status-danger">*</span>}
            </label>
            {f.options ? (
              <select
                value={details[f.key] ?? ''}
                disabled={disabled}
                onChange={(e) => setField(f.key, e.target.value)}
                className={inputClass}
              >
                <option value="">Select</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.numeric ? 'number' : 'text'}
                min={f.numeric ? 0 : undefined}
                step={f.numeric ? '0.01' : undefined}
                inputMode={f.key === 'cardLast4' ? 'numeric' : undefined}
                maxLength={f.maxLength}
                value={details[f.key] ?? ''}
                disabled={disabled}
                placeholder={f.placeholder}
                onChange={(e) => setField(f.key, f.key === 'cardLast4' ? e.target.value.replace(/\D/g, '') : e.target.value)}
                className={`${inputClass} ${f.key === 'ifsc' ? 'uppercase' : ''}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
