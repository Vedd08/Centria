import React from 'react';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  className?: string;
}

const variantDotStyles: Record<StatusVariant, string> = {
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  danger: 'bg-status-danger',
  accent: 'bg-brand',
  neutral: 'bg-ink-secondary',
};

const variantTextStyles: Record<StatusVariant, string> = {
  success: 'text-status-success',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
  accent: 'text-brand-deep',
  neutral: 'text-ink-secondary',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  className = '',
}) => {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${variantTextStyles[variant]} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${variantDotStyles[variant]}`} />
      <span>{label}</span>
    </span>
  );
};
