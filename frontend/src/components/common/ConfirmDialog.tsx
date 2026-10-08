import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<Props> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'bg-status-danger/10 text-status-danger border-status-danger/20',
    warning: 'bg-status-warning/10 text-status-warning border-status-warning/20',
    info: 'bg-brand-soft text-brand-deep border-brand/20',
  };

  const buttonStyles = {
    danger: 'bg-status-danger hover:bg-status-danger/80',
    warning: 'bg-status-warning hover:bg-status-warning/80',
    info: 'bg-brand hover:bg-brand-deep',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink-primary flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${variant === 'danger' ? 'text-status-danger' : variant === 'warning' ? 'text-status-warning' : 'text-brand'}`} />
            {title}
          </h3>
          <button onClick={onCancel} className="p-1 rounded text-ink-secondary hover:bg-surface-page cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-ink-secondary leading-relaxed">{message}</p>

        <div className={`p-3 rounded-lg border text-xs ${variantStyles[variant]}`}>
          This action cannot be undone.
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium text-ink-secondary hover:text-ink-primary rounded-md cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-md shadow-xs cursor-pointer disabled:opacity-50 ${buttonStyles[variant]}`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
