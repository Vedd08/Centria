/** Pack info for a medicine: stock and prices are per single unit (one tablet). */
export interface PackInfo {
  unit: string;
  packSize?: number | null;
  packLabel?: string | null;
  sellLoose?: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 || /s$/.test(word) ? '' : 's'}`;

export const hasPack = (m?: PackInfo | null): m is PackInfo & { packSize: number } => !!m?.packSize && m.packSize > 1;

/** "15 tablets (1 strip + 5 loose)", "20 tablets (2 strips)", or "3 tubes". */
export const describeQty = (qty: number, m?: PackInfo | null): string => {
  const base = plural(qty, m?.unit || 'unit');
  if (!hasPack(m) || qty <= 0) return base;
  const packs = Math.floor(qty / m.packSize);
  const loose = qty % m.packSize;
  const label = m.packLabel || 'pack';
  const parts = [packs ? plural(packs, label) : '', loose ? `${loose} loose` : ''].filter(Boolean);
  return `${base} (${parts.join(' + ')})`;
};

/** Whether this quantity can be handed over: unsplittable packs go in whole packs. */
export const validQty = (qty: number, m?: PackInfo | null) =>
  qty >= 0 && Number.isInteger(qty) && (!hasPack(m) || m.sellLoose !== false || qty % m.packSize === 0);

/** "Strip of 10 tablets" */
export const packText = (m?: PackInfo | null) =>
  hasPack(m) ? `${(m.packLabel || 'pack').replace(/^./, (c) => c.toUpperCase())} of ${plural(m.packSize, m.unit)}` : '';
