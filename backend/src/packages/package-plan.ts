/**
 * Sitting plan for a sold package: when each sitting is due, when the package
 * expires, and what state it is in. Pure functions over YYYY-MM-DD strings, so the
 * packages screen, the doctor's screen and the follow-up worklist all agree.
 *
 * Rules
 * - Next sitting = last sitting + gap days (first sitting = sale date), unless the
 *   doctor planned a specific date. A date that lands on a Sunday or clinic holiday
 *   moves to the next open day when the package says so.
 * - Expiry = sale date + validity days + days the doctor extended it.
 * - A doctor-caused delay extends the expiry (red notice, no charge). A patient-caused
 *   lapse forfeits the remaining sittings — the patient buys again.
 */

export type PackageState =
  | 'ACTIVE'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'LAPSED'
  | 'COMPLETED';

export interface PlanInput {
  purchaseDate: string;
  totalSittings: number;
  sittingsUsed: number;
  sittingsRemaining: number;
  openingSittingsUsed?: number | null;
  sittingGapDays?: number | null;
  expiryDate?: string | null;
  extendedDays?: number | null;
  skipSundays?: boolean | null;
  skipHolidays?: boolean | null;
  plannedNextSitting?: string | null;
  lapsedAt?: string | null;
  /** Dates of the visits counted as sittings of this package. */
  visitDates: string[];
}

export interface PlannedSitting {
  number: number;
  date: string | null;
  status: 'DONE' | 'PLANNED';
  /** Planned for after the package expires — won't fit unless the plan changes. */
  afterExpiry?: boolean;
  /** Moved off a Sunday or holiday. */
  shifted?: boolean;
}

export interface PackagePlan {
  state: PackageState;
  expiryDate: string | null;
  daysToExpiry: number | null;
  nextSittingDate: string | null;
  /** The next sitting date was set by the doctor rather than computed. */
  nextIsDoctorPlanned: boolean;
  overdueDays: number;
  /** If a sitting is done today, when the one after it falls due. */
  nextIfDoneToday: string | null;
  extendedDays: number;
  sittingsPlannedAfterExpiry: number;
  schedule: PlannedSitting[];
}

const EXPIRING_SOON_DAYS = 7;

const toUtc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (d: string, n: number) => fromUtc(toUtc(d) + n * 86400000);
export const diffDays = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / 86400000);
export const isValidDate = (d: unknown): d is string =>
  typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(toUtc(d));

/** Moves a date forward past Sundays / clinic holidays, per the package's rules. */
export function nextOpenDay(
  d: string,
  opts: { skipSundays?: boolean | null; skipHolidays?: boolean | null },
  holidays: Set<string>,
): { date: string; shifted: boolean } {
  let date = d;
  for (let i = 0; i < 60; i++) {
    const sunday = new Date(toUtc(date)).getUTCDay() === 0;
    const closed = (opts.skipSundays !== false && sunday) || (opts.skipHolidays !== false && holidays.has(date));
    if (!closed) return { date, shifted: date !== d };
    date = addDays(date, 1);
  }
  return { date, shifted: date !== d };
}

export function computePlan(p: PlanInput, holidays: Set<string>, today: string): PackagePlan {
  const gap = p.sittingGapDays && p.sittingGapDays > 0 ? p.sittingGapDays : null;
  const rules = { skipSundays: p.skipSundays, skipHolidays: p.skipHolidays };
  const visits = [...p.visitDates].filter(isValidDate).sort();
  const opening = Math.max(0, p.openingSittingsUsed ?? 0);
  const expiryDate = p.expiryDate || null;

  const schedule: PlannedSitting[] = [];
  let n = 1;
  for (let i = 0; i < opening && n <= p.totalSittings; i++) schedule.push({ number: n++, date: null, status: 'DONE' });
  for (const d of visits) {
    if (n > p.totalSittings) break;
    schedule.push({ number: n++, date: d, status: 'DONE' });
  }

  const lastDone = visits[visits.length - 1] ?? null;
  const done = Math.max(p.sittingsUsed, schedule.length);
  const remaining = Math.max(0, p.totalSittings - done);

  let nextSittingDate: string | null = null;
  let nextIsDoctorPlanned = false;
  if (remaining > 0 && !p.lapsedAt) {
    if (p.plannedNextSitting && isValidDate(p.plannedNextSitting) && (!lastDone || p.plannedNextSitting > lastDone)) {
      nextSittingDate = p.plannedNextSitting;
      nextIsDoctorPlanned = true;
    } else if (!lastDone && opening === 0) {
      nextSittingDate = nextOpenDay(p.purchaseDate, rules, holidays).date;
    } else if (lastDone && gap) {
      nextSittingDate = nextOpenDay(addDays(lastDone, gap), rules, holidays).date;
    }
  }

  // Future sittings chain from the next one, one gap apart.
  let prev: string | null = nextSittingDate;
  let afterExpiry = 0;
  for (let i = 0; i < remaining && n <= p.totalSittings; i++) {
    let date: string | null = null;
    let shifted = false;
    if (i === 0) {
      date = nextSittingDate;
      shifted = !!date && !nextIsDoctorPlanned && !!lastDone && !!gap && date !== addDays(lastDone, gap);
    } else if (prev && gap) {
      const r = nextOpenDay(addDays(prev, gap), rules, holidays);
      date = r.date;
      shifted = r.shifted;
    }
    const late = !!(date && expiryDate && date > expiryDate);
    if (late) afterExpiry++;
    schedule.push({ number: n++, date, status: 'PLANNED', ...(late ? { afterExpiry: true } : {}), ...(shifted ? { shifted: true } : {}) });
    prev = date;
  }

  const daysToExpiry = expiryDate ? diffDays(today, expiryDate) : null;
  const overdueDays = nextSittingDate && nextSittingDate < today ? diffDays(nextSittingDate, today) : 0;

  let state: PackageState;
  if (remaining <= 0 || p.sittingsRemaining <= 0) state = 'COMPLETED';
  else if (p.lapsedAt) state = 'LAPSED';
  else if (expiryDate && today > expiryDate) state = 'EXPIRED';
  else if (overdueDays > 0) state = 'OVERDUE';
  else if (nextSittingDate === today) state = 'DUE_TODAY';
  else if (daysToExpiry !== null && daysToExpiry <= EXPIRING_SOON_DAYS) state = 'EXPIRING_SOON';
  else state = 'ACTIVE';

  const nextIfDoneToday = remaining > 1 && gap ? nextOpenDay(addDays(today, gap), rules, holidays).date : null;

  return {
    state,
    expiryDate,
    daysToExpiry,
    nextSittingDate,
    nextIsDoctorPlanned,
    overdueDays,
    nextIfDoneToday,
    extendedDays: p.extendedDays ?? 0,
    sittingsPlannedAfterExpiry: afterExpiry,
    schedule,
  };
}

// ---------------------------------------------------------------------------
// Multi-treatment packages: each treatment has its own sittings and gap; the
// package's expiry / lapse / doctor extension cover all of them.
// ---------------------------------------------------------------------------

export interface ItemPlanInput {
  id: string;
  name: string;
  treatmentId?: string | null;
  totalSittings: number;
  sittingGapDays?: number | null;
  openingSittingsUsed?: number | null;
  plannedNextSitting?: string | null;
  /** Dates of this treatment's recorded sittings. */
  sittingDates: string[];
}

export interface PurchasePlanInput {
  purchaseDate: string;
  expiryDate?: string | null;
  extendedDays?: number | null;
  skipSundays?: boolean | null;
  skipHolidays?: boolean | null;
  lapsedAt?: string | null;
  items: ItemPlanInput[];
}

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

export interface PurchasePlan extends PackagePlan {
  /** Name of the treatment whose sitting is next. */
  nextTreatment: string | null;
  items: ItemPlan[];
}

const STATE_RANK: PackageState[] = ['LAPSED', 'EXPIRED', 'OVERDUE', 'DUE_TODAY', 'EXPIRING_SOON', 'ACTIVE', 'COMPLETED'];

export const itemUsed = (item: { totalSittings: number; openingSittingsUsed?: number | null }, recorded: number) =>
  Math.min(item.totalSittings, Math.max(0, item.openingSittingsUsed ?? 0) + recorded);

export function computePurchasePlan(p: PurchasePlanInput, holidays: Set<string>, today: string): PurchasePlan {
  const items: ItemPlan[] = p.items.map((it) => {
    const used = itemUsed(it, it.sittingDates.length);
    const remaining = Math.max(0, it.totalSittings - used);
    const plan = computePlan(
      {
        purchaseDate: p.purchaseDate,
        totalSittings: it.totalSittings,
        sittingsUsed: used,
        sittingsRemaining: remaining,
        openingSittingsUsed: it.openingSittingsUsed,
        sittingGapDays: it.sittingGapDays,
        expiryDate: p.expiryDate,
        extendedDays: p.extendedDays,
        skipSundays: p.skipSundays,
        skipHolidays: p.skipHolidays,
        plannedNextSitting: it.plannedNextSitting,
        lapsedAt: p.lapsedAt,
        visitDates: it.sittingDates,
      },
      holidays,
      today,
    );
    return {
      id: it.id,
      name: it.name,
      treatmentId: it.treatmentId ?? null,
      totalSittings: it.totalSittings,
      sittingsUsed: used,
      sittingsRemaining: remaining,
      sittingGapDays: it.sittingGapDays ?? null,
      plan,
    };
  });

  const open = items.filter((i) => i.sittingsRemaining > 0);
  const expiryDate = p.expiryDate || null;
  const daysToExpiry = expiryDate ? diffDays(today, expiryDate) : null;

  // Package state = the most urgent state among its treatments.
  let state: PackageState = 'COMPLETED';
  if (open.length) {
    state = open.map((i) => i.plan.state).sort((a, b) => STATE_RANK.indexOf(a) - STATE_RANK.indexOf(b))[0];
  }

  const next = open
    .filter((i) => i.plan.nextSittingDate)
    .sort((a, b) => (a.plan.nextSittingDate! < b.plan.nextSittingDate! ? -1 : 1))[0];

  return {
    state,
    expiryDate,
    daysToExpiry,
    nextSittingDate: next?.plan.nextSittingDate ?? null,
    nextIsDoctorPlanned: next?.plan.nextIsDoctorPlanned ?? false,
    nextTreatment: next?.name ?? null,
    overdueDays: Math.max(0, ...open.map((i) => i.plan.overdueDays)),
    nextIfDoneToday: next?.plan.nextIfDoneToday ?? null,
    extendedDays: p.extendedDays ?? 0,
    sittingsPlannedAfterExpiry: open.reduce((s, i) => s + i.plan.sittingsPlannedAfterExpiry, 0),
    // Combined schedule, kept for older screens; the per-treatment one is in `items`.
    schedule: items.flatMap((i) => i.plan.schedule),
    items,
  };
}

/** Whether a sitting can be counted against this package on `date`. Returns the reason if not. */
export function sittingBlockReason(
  p: { lapsedAt?: string | null; expiryDate?: string | null; sittingsRemaining: number; packageName?: string },
  date: string,
): string | null {
  if (p.lapsedAt) return `${p.packageName ?? 'This package'} lapsed on ${p.lapsedAt} (missed by the patient) — the patient has to buy it again`;
  if (p.expiryDate && date > p.expiryDate) {
    return `${p.packageName ?? 'This package'} expired on ${p.expiryDate}. If the delay was the clinic's, the doctor can extend it from Packages; otherwise sell a new package`;
  }
  if (p.sittingsRemaining <= 0) return `${p.packageName ?? 'This package'} has no sittings left`;
  return null;
}
