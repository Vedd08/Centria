import React from 'react';
import { FollowUpsTab } from './FollowUpsTab';

/** Stand-alone follow-ups page for nurses / staff, who don't have the reception desk. */
export const FollowUpsScreen: React.FC = () => (
  <div className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
    <FollowUpsTab />
  </div>
);
