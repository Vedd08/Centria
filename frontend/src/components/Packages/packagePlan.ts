/** Mirrors backend/src/packages/package-plan.ts — the plan the API attaches to each sold package. */
export type PackageState = 'ACTIVE' | 'DUE_TODAY' | 'OVERDUE' | 'EXPIRING_SOON' | 'EXPIRED' | 'LAPSED' | 'COMPLETED';

export interface PlannedSitting {
  number: number;
  date: string | null;
  status: 'DONE' | 'PLANNED';
  afterExpiry?: boolean;
  shifted?: boolean;
}

export interface PackagePlan {
  state: PackageState;
  expiryDate: string | null;
  daysToExpiry: number | null;
  nextSittingDate: string | null;
  nextIsDoctorPlanned: boolean;
  overdueDays: number;
  nextIfDoneToday: string | null;
  extendedDays: number;
  sittingsPlannedAfterExpiry: number;
  schedule: PlannedSitting[];
}

/** One treatment of a sold package, with its own sittings and plan. */
export interface ItemPlan {
  id: string;
  name: string;
  treatmentId: string | null;
  totalSittings: number;
  sittingsUsed: number;
  sittingsRemaining: number;
  sittingGapDays: number | null;
  plan: PackagePlan;
}

/** Package-level plan: most urgent state, earliest next sitting, plus each treatment. */
export interface PurchasePlan extends PackagePlan {
  nextTreatment: string | null;
  items: ItemPlan[];
}

/** A treatment line of a package type (catalogue). */
export interface PackageTypeLine {
  id?: string;
  treatmentId?: string | null;
  name: string;
  sittings: number;
  sittingGapDays?: number | null;
}

/** "5× Q-Switch every 30d · 3× Carbon Peel every 15d". */
export const linesSummary = (lines?: PackageTypeLine[]) =>
  (lines || []).map((l) => `${l.sittings}× ${l.name}${l.sittingGapDays ? ` every ${l.sittingGapDays}d` : ''}`).join(' · ');

export interface PackageAdjustment {
  id: string;
  kind: 'DOCTOR_DELAY' | 'PATIENT_LAPSE' | 'RESCHEDULE' | 'REINSTATE' | 'SITTING_UNDONE';
  days: number;
  note?: string | null;
  byName: string;
  createdAt: string;
}

export const STATE_STYLE: Record<PackageState, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-status-success/10 text-status-success border-status-success/20' },
  DUE_TODAY: { label: 'Sitting due today', className: 'bg-brand/10 text-brand-deep border-brand/30' },
  OVERDUE: { label: 'Sitting overdue', className: 'bg-status-warning/10 text-status-warning border-status-warning/30' },
  EXPIRING_SOON: { label: 'Expiring soon', className: 'bg-status-warning/10 text-status-warning border-status-warning/30' },
  EXPIRED: { label: 'Expired — needs decision', className: 'bg-status-danger/10 text-status-danger border-status-danger/30' },
  LAPSED: { label: 'Lapsed — buy again', className: 'bg-status-danger/10 text-status-danger border-status-danger/30' },
  COMPLETED: { label: 'Completed', className: 'bg-surface-page text-ink-secondary border-border' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Tue, 25 Nov 2026" from YYYY-MM-DD, without timezone drift. */
export const fmtDate = (d?: string | null, withDay = false) => {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '—';
  const [y, m, day] = d.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return `${withDay ? `${DAYS[dow]}, ` : ''}${day} ${MONTHS[m - 1]} ${y}`;
};

export const addDaysStr = (d: string, n: number) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day) + n * 86400000).toISOString().slice(0, 10);
};

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** "expires in 12 days" / "expired 3 days ago" / "no expiry". */
export const expiryText = (plan?: PackagePlan | null) => {
  if (!plan?.expiryDate || plan.daysToExpiry === null) return 'No expiry set';
  const d = plan.daysToExpiry;
  if (d < 0) return `Expired ${-d} day${d === -1 ? '' : 's'} ago`;
  if (d === 0) return 'Expires today';
  return `Expires in ${d} day${d === 1 ? '' : 's'}`;
};
