import { StatusVariant } from '../common/StatusBadge';

/** Shared between AdmissionDetail, IPDBoard, and ProgressNotesFeed so the condition reads the same everywhere. */
export const CONDITION_LABEL: Record<string, string> = {
  STABLE: 'Stable',
  NEEDS_ATTENTION: 'Needs Attention',
  CRITICAL: 'Critical',
};

export const conditionVariant = (status: string): StatusVariant =>
  status === 'CRITICAL' ? 'danger' : status === 'NEEDS_ATTENTION' ? 'warning' : 'success';

const STATUS_RANK = {
  STABLE: 0,
  NEEDS_ATTENTION: 1,
  CRITICAL: 2,
};

export const getConditionTrend = (latestStatus?: string | null, prevStatus?: string | null): 'IMPROVING' | 'SAME' | 'WORSENING' | null => {
  if (!latestStatus || !prevStatus) return null;
  const latestRank = STATUS_RANK[latestStatus as keyof typeof STATUS_RANK] ?? -1;
  const prevRank = STATUS_RANK[prevStatus as keyof typeof STATUS_RANK] ?? -1;
  
  if (latestRank === -1 || prevRank === -1) return null;
  if (latestRank < prevRank) return 'IMPROVING';
  if (latestRank > prevRank) return 'WORSENING';
  return 'SAME';
};
