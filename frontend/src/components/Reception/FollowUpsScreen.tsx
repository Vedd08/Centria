import React, { useState } from 'react';
import { FollowUpsTab } from './FollowUpsTab';
import { SittingFollowUpsBoard } from './SittingFollowUpsBoard';

/** Stand-alone follow-ups page for nurses / staff, who don't have the reception desk. */
export const FollowUpsScreen: React.FC = () => {
  const [view, setView] = useState<'sittings' | 'all'>('sittings');
  return (
    <div className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs space-y-4">
      <div className="inline-flex rounded-md border border-border p-0.5 bg-surface-page">
        {([['sittings', 'Package Sittings'], ['all', 'All follow-ups']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer ${view === key ? 'bg-surface-card text-brand-deep shadow-xs' : 'text-ink-secondary hover:text-ink-primary'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'sittings' ? <SittingFollowUpsBoard /> : <FollowUpsTab />}
    </div>
  );
};
