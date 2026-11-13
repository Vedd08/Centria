/**
 * Nurse and Staff are one role ("Nurse / Staff") covering both the ward (IPD) and
 * outpatients (OPD). Accounts created as STAFF before the merge are still stored
 * that way; they are read as NURSE everywhere — at login, on every request, and
 * whenever a role is saved — so no existing account has to be edited.
 */
export const normalizeRole = (role: string | null | undefined): string =>
  role === 'STAFF' ? 'NURSE' : (role ?? '');

/** Both stored values of the merged role, for database filters. */
export const NURSE_STAFF_ROLES = ['NURSE', 'STAFF'];
