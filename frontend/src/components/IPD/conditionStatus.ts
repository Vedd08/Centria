import { StatusVariant } from '../common/StatusBadge';

/** Shared between AdmissionDetail, IPDBoard, and ProgressNotesFeed so the condition reads the same everywhere. */
export const CONDITION_LABEL: Record<string, string> = {
  STABLE: 'Stable',
  NEEDS_ATTENTION: 'Needs Attention',
  CRITICAL: 'Critical',
};

export const conditionVariant = (status: string): StatusVariant =>
  status === 'CRITICAL' ? 'danger' : status === 'NEEDS_ATTENTION' ? 'warning' : 'success';
