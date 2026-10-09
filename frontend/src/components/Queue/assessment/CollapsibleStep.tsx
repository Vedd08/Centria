import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleStepProps {
  step: number;
  title: string;
  summary?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export const CollapsibleStep: React.FC<CollapsibleStepProps> = ({ step, title, summary, children, defaultExpanded = true }) => {
  const storageKey = `assessment-step-${step}-expanded`;
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return defaultExpanded;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(expanded));
    } catch (e) {}
  }, [expanded, storageKey]);

  return (
    <div className="bg-surface-card rounded-[10px] border border-border shadow-xs overflow-hidden mb-4">
      <div 
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-surface-page transition-colors select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand/10 text-brand text-xs font-bold shrink-0">
          {step}
        </div>
        <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-ink-primary whitespace-nowrap">{title}</h3>
          {!expanded && summary && (
            <div className="text-xs text-ink-secondary truncate flex-1 text-right">{summary}</div>
          )}
        </div>
        <div className="text-ink-secondary shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>
      {expanded && (
        <div className="p-4 pt-0 border-t border-border mt-2">
          {children}
        </div>
      )}
    </div>
  );
};