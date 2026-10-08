import React from 'react';

interface LoadingSkeletonProps {
  rows?: number;
  className?: string;
}

/** Reusable loading skeleton for consistent loading states across all modules. */
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ rows = 1, className = '' }) => {
  return (
    <div className={`bg-surface-card rounded-[10px] border border-border p-6 shadow-xs ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 mb-4 last:mb-0"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          {/* Avatar placeholder */}
          <div className="w-10 h-10 rounded-full bg-border animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            {/* Title line */}
            <div className="h-3 bg-border rounded animate-pulse w-3/4" />
            {/* Subtitle line */}
            <div className="h-2.5 bg-border/60 rounded animate-pulse w-1/2" />
          </div>
          {/* Badge placeholder */}
          <div className="h-6 w-16 bg-border/40 rounded animate-pulse shrink-0" />
        </div>
      ))}
      {rows === 0 && (
        <div className="flex items-center justify-center py-6">
          <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  );
};

const COL_WIDTHS = ['40%', '55%', '30%', '25%', '20%', '35%', '45%', '50%', '60%', '28%'];

/** Skeleton for a single table row. */
export const TableRowSkeleton: React.FC<{ cols?: number }> = ({ cols = 6 }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="py-3.5 px-4">
        <div
          className="h-3 bg-border/60 rounded"
          style={{ width: COL_WIDTHS[i % COL_WIDTHS.length] }}
        />
      </td>
    ))}
  </tr>
);

/** Skeleton for a stat card. */
export const StatCardSkeleton: React.FC = () => (
  <div className="bg-surface-card rounded-[10px] border border-border p-4 shadow-xs animate-pulse">
    <div className="flex items-center gap-3.5">
      <div className="w-10 h-10 rounded-lg bg-border/60" />
      <div className="flex-1 space-y-1.5">
        <div className="h-2.5 bg-border/60 rounded w-2/3" />
        <div className="h-5 bg-border/60 rounded w-1/3" />
      </div>
    </div>
  </div>
);
