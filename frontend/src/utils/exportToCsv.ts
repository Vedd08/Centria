/** Export an array of objects as a CSV file download. */
export function exportToCsv<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columns: { key: keyof T; label: string; format?: (val: any, row: T) => string }[],
) {
  if (rows.length === 0) return;

  const header = columns.map((c) => `"${c.label}"`).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw = row[c.key];
          const formatted = c.format ? c.format(raw, row) : raw;
          const str = formatted == null ? '' : String(formatted);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(','),
    )
    .join('\n');

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
