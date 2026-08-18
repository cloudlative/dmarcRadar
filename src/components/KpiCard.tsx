interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
}

export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <span
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ backgroundImage: "linear-gradient(90deg, var(--brand-from), var(--brand-to))" }}
        aria-hidden="true"
      />
      <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-ink-faint">{hint}</div> : null}
    </div>
  );
}
