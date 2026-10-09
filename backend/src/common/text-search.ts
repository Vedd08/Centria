/**
 * A case-insensitive "contains" filter for free-text search boxes.
 *
 * SQLite (local dev) already matches LIKE case-insensitively, but Postgres
 * (production) does not, so "ravi" would stop finding "Ravi" once deployed.
 * Prisma's SQLite client rejects `mode`, so it is only added on Postgres.
 */
export function textContains(term: string): { contains: string } {
  const isPostgres = /^postgres(ql)?:/.test(process.env.DATABASE_URL ?? '');
  return (isPostgres ? { contains: term, mode: 'insensitive' } : { contains: term }) as { contains: string };
}
