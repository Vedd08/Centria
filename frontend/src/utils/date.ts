const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Formats a date as dd-mm-yyyy, the way the clinic writes dates.
 *
 * Accepts a calendar date string ("2026-07-12", stored by the backend for visits,
 * DOBs, bills) or a timestamp (ISO string / Date). Calendar dates are rearranged
 * as text rather than parsed, because `new Date("2026-07-12")` is UTC midnight and
 * can show the previous day in some time zones. Returns "—" for empty values.
 */
export const fmtDate = (value?: string | Date | null): string => {
  if (!value) return '—';
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};

/** dd-mm-yyyy hh:mm (24h), for timestamps where the time matters. */
export const fmtDateTime = (value?: string | Date | null): string => {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
