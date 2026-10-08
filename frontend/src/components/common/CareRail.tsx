import React from 'react';

/**
 * The care rail — where a patient has got to today.
 *
 * Five segments matching the clinic's actual pipeline: reception checks them in,
 * the doctor assesses, the ward or service desk carries out the orders, the pharmacy
 * hands over medicines, reception settles the bill. Filled segments read left to
 * right, so "how far along is this patient" is answerable without reading a word.
 */
export type QueueStatus =
  | 'WAITING'
  | 'WITH_DOCTOR'
  | 'AWAITING_SERVICE'
  | 'IN_SERVICE'
  | 'COMPLETED'
  | 'CANCELLED';

const STAGES = ['Checked in', 'Doctor', 'Service', 'Pharmacy', 'Settled'] as const;

/** How many stages are finished, and which stage the patient is sitting in now. */
const PROGRESS: Record<QueueStatus, { done: number; activeIndex: number | null }> = {
  WAITING: { done: 1, activeIndex: 1 },
  WITH_DOCTOR: { done: 1, activeIndex: 1 },
  AWAITING_SERVICE: { done: 2, activeIndex: 2 },
  IN_SERVICE: { done: 2, activeIndex: 2 },
  COMPLETED: { done: 5, activeIndex: null },
  CANCELLED: { done: 0, activeIndex: null },
};

interface CareRailProps {
  status: QueueStatus | string;
  /** Pharmacy still owes this patient something — shown as a waiting segment. */
  pendingDispense?: boolean;
  showLabel?: boolean;
  className?: string;
}

export const CareRail: React.FC<CareRailProps> = ({
  status,
  pendingDispense = false,
  showLabel = false,
  className = '',
}) => {
  const cancelled = status === 'CANCELLED';
  const { done, activeIndex } = PROGRESS[status as QueueStatus] ?? PROGRESS.WAITING;

  const stateFor = (i: number): string | undefined => {
    if (cancelled) return undefined;
    if (i < done) return 'done';
    if (i === 3 && pendingDispense) return 'wait';
    if (i === activeIndex) return 'active';
    return undefined;
  };

  return (
    <div className={className}>
      <div
        className="care-rail"
        role="img"
        aria-label={
          cancelled
            ? 'Visit cancelled'
            : `Progress: ${STAGES[Math.min(done, STAGES.length - 1)]}, ${done} of ${STAGES.length} stages done`
        }
      >
        {STAGES.map((stage, i) => (
          <span key={stage} className="care-rail-seg" data-state={stateFor(i)} title={stage} />
        ))}
      </div>
      {showLabel && (
        <p className="text-[10px] text-ink-faint mt-1">
          {cancelled ? 'Cancelled' : `${STAGES[Math.min(done, STAGES.length - 1)]} · ${done}/${STAGES.length}`}
        </p>
      )}
    </div>
  );
};
