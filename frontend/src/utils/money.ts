/**
 * The one place rupee amounts get formatted for display.
 *
 * Always two decimals, always Indian grouping. Screens used to carry their own
 * copies of this and they disagreed: the accounts dashboard rounded to whole
 * rupees while the printed bill showed paise, so the same encounter read as
 * ₹1,710 in one place and ₹1,710.37 in another — a 37 paise gap that someone
 * has to chase at the end of the month.
 */
export const money = (n: number | string | null | undefined): string =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Same figure without the symbol, for columns that carry ₹ in the header. */
export const amount = (n: number | string | null | undefined): string =>
  Number(n ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Renders a blank cell for a missing figure instead of a misleading ₹0.00. */
export const moneyOrDash = (n: number | string | null | undefined): string =>
  n === null || n === undefined || Number(n) === 0 ? '—' : money(n);
