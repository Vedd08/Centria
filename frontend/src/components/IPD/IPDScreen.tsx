import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DayBookScreen } from '../DayBook/DayBookScreen';
import { IPDBoard } from './IPDBoard';
import { ClipboardList, BedDouble } from 'lucide-react';

type IpdTab = 'daybook' | 'ward';

/**
 * IPD has two halves that the clinic thinks of separately:
 *  - Day Book: the procedure/surgery register carried over from their spreadsheet.
 *  - Ward & Admissions: bed occupancy, the drug chart and recovery notes.
 * Nurses only ever need the ward, so they land straight on it.
 */
export const IPDScreen: React.FC = () => {
  const { user } = useAuth();
  const isNurse = user?.role === 'NURSE';
  const [tab, setTab] = useState<IpdTab>(isNurse ? 'ward' : 'daybook');

  // The day book is a billing/consultation register — not part of a nurse's job.
  if (isNurse) return <IPDBoard />;

  const TABS: { key: IpdTab; label: string; icon: React.ElementType }[] = [
    { key: 'daybook', label: 'Day Book', icon: ClipboardList },
    { key: 'ward', label: 'Ward & Admissions', icon: BedDouble },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 bg-surface-card px-2 rounded-[10px] border border-border shadow-xs">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                tab === t.key
                  ? 'border-brand text-brand-deep'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'daybook' ? (
        <DayBookScreen
          visitType="IPD"
          title="IPD — Procedure Day Book"
          subtitle="Surgical and procedure register. Open any row to see that patient's full history, images and lifetime value."
        />
      ) : (
        <IPDBoard />
      )}
    </div>
  );
};
