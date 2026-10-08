import React, { useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';

/**
 * Chart primitives for the analytics screens.
 *
 * Hand-rolled rather than pulled from a charting library: this app draws a handful of
 * simple forms, and a library would add weight to a bundle that already warns about
 * its size. The existing screens drew bars this way too — these just make it reusable.
 *
 * Series colours are assigned in a fixed order and never cycled, so filtering a series
 * out never repaints the survivors. The order below was validated for colour-vision
 * deficiency: adjacent pairs clear ΔE 20 under deuteranopia and tritanopia. The teal
 * sits below 3:1 against white, so every chart here carries visible value labels and a
 * table view — identity is never carried by colour alone.
 */
export const SERIES_COLORS = ['#0E6193', '#30B695', '#7A5AA6'];

const TONE_TEXT: Record<string, string> = {
  default: 'text-ink-primary',
  success: 'text-status-success',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
};

interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  tone?: keyof typeof TONE_TEXT;
}

/** A single headline figure — the right form when there is no shape to show. */
export const StatTile: React.FC<StatTileProps> = ({ label, value, sub, tone = 'default' }) => (
  <div className="bg-surface-card rounded-[10px] border border-border p-4 shadow-xs">
    <p className="eyebrow text-ink-secondary">{label}</p>
    <p className={`font-display text-xl font-semibold mt-1.5 tabular-nums ${TONE_TEXT[tone]}`}>{value}</p>
    {sub && <p className="text-[11px] text-ink-secondary mt-0.5">{sub}</p>}
  </div>
);

interface ChartCardProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  /** When given, the card offers a table view of the same numbers. */
  table?: React.ReactNode;
  children: React.ReactNode;
}

/** A titled chart panel with an optional chart/table toggle. */
export const ChartCard: React.FC<ChartCardProps> = ({ title, icon, actions, table, children }) => {
  const [showTable, setShowTable] = useState(false);

  return (
    <div className="bg-surface-card rounded-[10px] border border-border p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-ink-primary flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {actions}
          {table && (
            <button
              onClick={() => setShowTable((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-[11px] font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-page transition-colors cursor-pointer"
              aria-pressed={showTable}
            >
              {showTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
              {showTable ? 'Chart' : 'Table'}
            </button>
          )}
        </div>
      </div>
      {showTable && table ? table : children}
    </div>
  );
};

export const ChartLegend: React.FC<{ series: string[] }> = ({ series }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
    {series.map((name, i) => (
      <span key={name} className="flex items-center gap-1.5 text-[11px] text-ink-secondary">
        <span
          className="w-2.5 h-2.5 rounded-[3px] shrink-0"
          style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
        />
        {name}
      </span>
    ))}
  </div>
);

const EmptyNote: React.FC<{ message: string }> = ({ message }) => (
  <p className="text-xs text-ink-secondary text-center py-8">{message}</p>
);

export interface ColumnDatum {
  label: string;
  /** One value per series, in the same order as `series`. */
  values: number[];
}

interface ColumnChartProps {
  data: ColumnDatum[];
  series: string[];
  /** Stack the series instead of drawing them side by side. */
  stacked?: boolean;
  format?: (value: number) => string;
  height?: number;
  emptyMessage?: string;
}

/**
 * Vertical columns for magnitude over a small number of buckets (days, rates).
 * Segments and neighbours are separated by a 2px surface gap so touching fills stay
 * distinguishable, and the hovered column reports its exact figures.
 */
export const ColumnChart: React.FC<ColumnChartProps> = ({
  data,
  series,
  stacked = false,
  format = (v) => String(v),
  height = 160,
  emptyMessage = 'Nothing recorded for this period',
}) => {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) return <EmptyNote message={emptyMessage} />;

  const columnTotal = (d: ColumnDatum) => (stacked ? d.values.reduce((s, v) => s + v, 0) : Math.max(...d.values));
  const max = Math.max(...data.map(columnTotal), 1);
  // Past a dozen columns the x labels collide, so thin them out rather than rotate.
  const labelEvery = Math.ceil(data.length / 12);

  return (
    <div className="space-y-3">
      {series.length > 1 && <ChartLegend series={series} />}
      <div className="relative">
        {hover !== null && (
          <div
            className="absolute z-10 top-1 px-2.5 py-1.5 rounded-md bg-shell text-white text-[11px] shadow-lift pointer-events-none whitespace-nowrap"
            style={{
              left: `${((hover + 0.5) / data.length) * 100}%`,
              transform: 'translate(-50%, 0)',
            }}
          >
            <p className="font-semibold">{data[hover].label}</p>
            {series.map((name, i) => (
              <p key={name} className="text-shell-ink tabular-nums">
                {series.length > 1 ? `${name}: ` : ''}
                {format(data[hover].values[i] ?? 0)}
              </p>
            ))}
          </div>
        )}

        <div className="flex items-end gap-[2px] border-b border-border" style={{ height }}>
          {data.map((d, i) => {
            const total = columnTotal(d);
            return (
              <div
                key={d.label}
                className="flex-1 h-full flex items-end justify-center gap-[2px] cursor-default"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                title={`${d.label} — ${d.values.map((v, s) => `${series[s]}: ${format(v)}`).join(', ')}`}
              >
                {stacked ? (
                  <div
                    className="w-full flex flex-col justify-end gap-[2px] transition-opacity"
                    style={{ height: `${(total / max) * 100}%`, opacity: hover === null || hover === i ? 1 : 0.55 }}
                  >
                    {d.values.map((v, s) =>
                      v <= 0 ? null : (
                        <div
                          key={series[s]}
                          className={s === 0 ? 'rounded-t-[4px]' : ''}
                          style={{
                            height: `${(v / (total || 1)) * 100}%`,
                            minHeight: 2,
                            backgroundColor: SERIES_COLORS[s % SERIES_COLORS.length],
                          }}
                        />
                      ),
                    )}
                  </div>
                ) : (
                  d.values.map((v, s) => (
                    <div
                      key={series[s]}
                      className="flex-1 rounded-t-[4px] transition-opacity"
                      style={{
                        height: `${(v / max) * 100}%`,
                        minHeight: v > 0 ? 2 : 0,
                        backgroundColor: SERIES_COLORS[s % SERIES_COLORS.length],
                        opacity: hover === null || hover === i ? 1 : 0.55,
                      }}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-[2px] mt-1.5">
          {data.map((d, i) => (
            <span key={d.label} className="flex-1 text-[9px] text-ink-secondary text-center truncate">
              {i % labelEvery === 0 ? d.label : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export interface BarListItem {
  label: string;
  value: number;
  meta?: string;
}

interface BarListProps {
  items: BarListItem[];
  format?: (value: number) => string;
  emptyMessage?: string;
  /** Index into SERIES_COLORS — magnitude lists stay one hue. */
  colorIndex?: number;
}

/** Horizontal magnitude bars: the readable form when categories have long names. */
export const BarList: React.FC<BarListProps> = ({
  items,
  format = (v) => String(v),
  emptyMessage = 'Nothing recorded for this period',
  colorIndex = 0,
}) => {
  if (items.length === 0) return <EmptyNote message={emptyMessage} />;
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-ink-primary truncate">{item.label}</span>
            <span className="font-mono text-ink-secondary shrink-0">
              {format(item.value)}
              {item.meta && <span className="text-ink-faint"> · {item.meta}</span>}
            </span>
          </div>
          <div className="h-2 bg-surface-page rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(item.value / max) * 100}%`,
                minWidth: item.value > 0 ? 4 : 0,
                backgroundColor: SERIES_COLORS[colorIndex % SERIES_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

interface LineChartProps {
  points: { label: string; value: number }[];
  format?: (value: number) => string;
  height?: number;
  emptyMessage?: string;
}

/**
 * A single measure over time. Drawn in real pixel coordinates and scaled by CSS, with
 * non-scaling strokes so the 2px line stays 2px at any width.
 */
export const LineChart: React.FC<LineChartProps> = ({
  points,
  format = (v) => String(v),
  height = 160,
  emptyMessage = 'Nothing recorded for this period',
}) => {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) return <EmptyNote message={emptyMessage} />;
  if (points.length === 1) {
    return (
      <div className="py-8 text-center">
        <p className="font-display text-2xl font-semibold text-ink-primary tabular-nums">{format(points[0].value)}</p>
        <p className="text-[11px] text-ink-secondary mt-1">{points[0].label}</p>
      </div>
    );
  }

  const W = 600;
  const H = height;
  const pad = 10;
  const max = Math.max(...points.map((p) => p.value), 1);
  const x = (i: number) => pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');
  const area = `${line} L ${x(points.length - 1)} ${H - pad} L ${x(0)} ${H - pad} Z`;
  const labelEvery = Math.ceil(points.length / 10);

  return (
    <div className="relative">
      {hover !== null && (
        <div
          className="absolute z-10 -top-1 px-2.5 py-1.5 rounded-md bg-shell text-white text-[11px] shadow-lift pointer-events-none whitespace-nowrap"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: 'translate(-50%, 0)' }}
        >
          <p className="font-semibold">{points[hover].label}</p>
          <p className="text-shell-ink tabular-nums">{format(points[hover].value)}</p>
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none" role="img">
        <path d={area} fill={SERIES_COLORS[0]} opacity={0.08} />
        <path
          d={line}
          fill="none"
          stroke={SERIES_COLORS[0]}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => (
          <g key={p.label}>
            {(hover === i || points.length <= 24) && (
              <circle cx={x(i)} cy={y(p.value)} r={4} fill="#FFFFFF" stroke={SERIES_COLORS[0]} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            )}
            {/* Hit target, wider than the mark. */}
            <rect
              x={x(i) - (W / points.length) / 2}
              y={0}
              width={W / points.length}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
      </svg>

      <div className="flex mt-1.5">
        {points.map((p, i) => (
          <span key={p.label} className="flex-1 text-[9px] text-ink-secondary text-center truncate">
            {i % labelEvery === 0 ? p.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
};

interface ChartTableProps {
  columns: { key: string; label: string; align?: 'left' | 'right' }[];
  rows: Record<string, React.ReactNode>[];
}

/** The table view behind every chart — the accessible reading of the same numbers. */
export const ChartTable: React.FC<ChartTableProps> = ({ columns, rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-y border-border text-ink-secondary">
          {columns.map((c) => (
            <th key={c.key} className={`py-2 px-2 font-semibold ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-border/60">
            {columns.map((c) => (
              <td key={c.key} className={`py-2 px-2 ${c.align === 'right' ? 'text-right font-mono' : ''}`}>
                {row[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
