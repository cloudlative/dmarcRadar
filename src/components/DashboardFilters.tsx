"use client";

interface Domain {
  id: string;
  name: string;
}

const RANGE_PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "All time", days: 0 },
];

interface DashboardFiltersProps {
  domains: Domain[];
  domainId: string;
  onDomainChange: (id: string) => void;
  rangeDays: number;
  onRangeChange: (days: number) => void;
}

export function DashboardFilters({
  domains,
  domainId,
  onDomainChange,
  rangeDays,
  onRangeChange,
}: DashboardFiltersProps) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <select
        value={domainId}
        onChange={(e) => onDomainChange(e.target.value)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink"
      >
        <option value="">All domains</option>
        {domains.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <div className="flex gap-1 rounded-md border border-border bg-surface p-1">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => onRangeChange(p.days)}
            className={
              "rounded px-2.5 py-1 text-sm transition-colors " +
              (rangeDays === p.days ? "btn-primary font-medium" : "text-ink-muted hover:bg-surface-raised")
            }
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
