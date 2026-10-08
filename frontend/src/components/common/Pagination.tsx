import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ page, pageSize, total, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const startItem = Math.min((page - 1) * pageSize + 1, total);
  const endItem = Math.min(page * pageSize, total);

  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    const delta = 2;
    const left = Math.max(2, page - delta);
    const right = Math.min(totalPages - 1, page + delta);

    pages.push(1);
    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push('...');
    if (totalPages > 1) pages.push(totalPages);

    return pages;
  };

  return (
    <div className="flex items-center justify-between pt-4 px-1">
      <span className="text-[11px] text-ink-secondary font-medium">
        {startItem}–{endItem} of {total}
      </span>

      <nav className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="p-1.5 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-page disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="First page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-page disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {getPageNumbers().map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-ink-secondary/60">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[28px] h-7 px-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                p === page
                  ? 'bg-brand text-white font-semibold shadow-xs'
                  : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-page'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-page disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="p-1.5 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-page disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="Last page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </nav>
    </div>
  );
};
