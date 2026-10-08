/**
 * Prisma's default interactive-transaction budget is a 2s queue wait and a 5s body.
 * That is generous on a local Postgres but not against a managed/serverless instance
 * over the public internet, where a handful of sequential round trips inside a
 * transaction routinely lands in the 3-6s range and a cold connection pushes it past
 * 5s — surfacing to the client as an opaque 500.
 *
 * These limits are deliberately slack rather than tuned: the transactions they guard
 * (dispensing a prescription, logging a visit) are low-frequency, staff-initiated
 * writes where correctness matters far more than shaving latency.
 */
export const TRANSACTION_OPTIONS = {
  maxWait: 15_000,
  timeout: 30_000,
} as const;
