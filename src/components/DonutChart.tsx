"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";

export interface DonutDatum {
  label: string;
  value: number;
}

const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function CustomTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm shadow-lg">
      <div className="font-medium text-ink">{name}</div>
      <div className="text-ink-muted">
        {formatCompact(value)} ({pct}%)
      </div>
    </div>
  );
}

// Fixed height + scroll: however many slices a donut has (2 or 8), the legend occupies the
// same footprint, so cards in the same grid row stay the same height and adding more data
// never reflows or distorts the layout — it just scrolls within its own box.
const LEGEND_HEIGHT = "h-28";

function ChartLegend({ data, total }: { data: DonutDatum[]; total: number }) {
  return (
    <ul className={`${LEGEND_HEIGHT} mt-3 flex flex-col gap-1 overflow-y-auto pr-1`}>
      {data.map((d, i) => {
        const pct = total > 0 ? (d.value / total) * 100 : 0;
        return (
          <li key={d.label} className="flex items-center gap-2 text-xs leading-tight">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-ink-muted" title={d.label}>
              {d.label}
            </span>
            <span className="shrink-0 tabular-nums text-ink-faint">
              {formatCompact(d.value)} · {pct.toFixed(1)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

interface DonutChartProps {
  title: string;
  subtitle?: string;
  data: DonutDatum[];
  centerLabel?: string;
  emptyMessage?: string;
}

export function DonutChart({ title, subtitle, data, centerLabel, emptyMessage }: DonutChartProps) {
  const [showTable, setShowTable] = useState(false);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const hasData = data.length > 0 && total > 0;

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle ? <p className="text-xs text-ink-faint">{subtitle}</p> : null}
        </div>
        {hasData ? (
          <button
            onClick={() => setShowTable((v) => !v)}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-surface-raised"
            aria-label={showTable ? "Show chart" : "Show table"}
          >
            {showTable ? "Chart" : "Table"}
          </button>
        ) : null}
      </div>

      {!hasData ? (
        <div className="flex h-[19rem] items-center justify-center text-center text-sm text-ink-faint">
          {emptyMessage ?? "No data for this period"}
        </div>
      ) : showTable ? (
        <div className="h-[19rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-left text-ink-faint">
                <th className="pb-1 font-medium">Label</th>
                <th className="pb-1 text-right font-medium">Value</th>
                <th className="pb-1 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.label} className="border-t border-border">
                  <td className="flex items-center gap-2 py-1 text-ink">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                    />
                    <span className="truncate">{d.label}</span>
                  </td>
                  <td className="py-1 text-right tabular-nums text-ink">{formatCompact(d.value)}</td>
                  <td className="py-1 text-right tabular-nums text-ink-muted">
                    {((d.value / total) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          <div className="relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="rgb(var(--surface))"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-xl font-semibold text-ink">{centerLabel ?? formatCompact(total)}</div>
              <div className="text-[11px] text-ink-faint">total</div>
            </div>
          </div>
          <ChartLegend data={data} total={total} />
        </div>
      )}
    </div>
  );
}
