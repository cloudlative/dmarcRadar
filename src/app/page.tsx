"use client";

import { useEffect, useMemo, useState } from "react";
import { DonutChart, type DonutDatum } from "@/components/DonutChart";
import { KpiCard } from "@/components/KpiCard";
import { DashboardFilters } from "@/components/DashboardFilters";
import { FullPageSpinner } from "@/components/Spinner";

interface DomainStat {
  name: string;
  reportCount: number;
  volume: number;
  passRatePct: number;
}

interface DashboardStats {
  kpis: {
    totalReports: number;
    totalVolume: number;
    passRatePct: number;
    distinctSources: number;
  };
  passFail: DonutDatum[];
  disposition: DonutDatum[];
  spfResult: DonutDatum[];
  dkimResult: DonutDatum[];
  topDomains: DonutDatum[];
  topSourceIps: DonutDatum[];
  reportSource: DonutDatum[];
  topFailingSources: DonutDatum[];
  domainBreakdown: DomainStat[];
}

function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export default function DashboardPage() {
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
  const [domainId, setDomainId] = useState("");
  const [rangeDays, setRangeDays] = useState(7);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/domains")
      .then((r) => r.json())
      .then((d) => setDomains(d.domains ?? []));
  }, []);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (domainId) p.set("domainId", domainId);
    if (rangeDays > 0) {
      const from = new Date();
      from.setDate(from.getDate() - rangeDays);
      p.set("from", from.toISOString());
    }
    return p.toString();
  }, [domainId, rangeDays]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/stats?${params}`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .finally(() => setLoading(false));
  }, [params]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-ink">Dashboard</h1>

      <DashboardFilters
        domains={domains}
        domainId={domainId}
        onDomainChange={setDomainId}
        rangeDays={rangeDays}
        onRangeChange={setRangeDays}
      />

      {loading || !stats ? (
        <FullPageSpinner />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard label="Total reports" value={String(stats.kpis.totalReports)} />
            <KpiCard label="Total message volume" value={formatCompact(stats.kpis.totalVolume)} />
            <KpiCard label="DMARC pass rate" value={`${stats.kpis.passRatePct}%`} />
            <KpiCard label="Distinct sending sources" value={String(stats.kpis.distinctSources)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DonutChart
              title="Overall DMARC outcome"
              subtitle="Aligned pass vs. fail, by volume"
              data={stats.passFail}
            />
            <DonutChart
              title="Disposition applied"
              subtitle="none / quarantine / reject"
              data={stats.disposition}
            />
            <DonutChart title="SPF result" subtitle="By message volume" data={stats.spfResult} />
            <DonutChart title="DKIM result" subtitle="By message volume" data={stats.dkimResult} />
            <DonutChart
              title="Top domains by volume"
              subtitle="Policy domain in published policy"
              data={stats.topDomains}
            />
            <DonutChart
              title="Top sending source IPs"
              subtitle="By message volume"
              data={stats.topSourceIps}
            />
            <DonutChart
              title="Report ingestion source"
              subtitle="Manual upload vs. email"
              data={stats.reportSource}
            />
            <DonutChart
              title="Top failing sources"
              subtitle="Not DMARC-aligned or disposition ≠ none"
              data={stats.topFailingSources}
              emptyMessage="No failing sources in this period"
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Domains</h2>
              <p className="text-xs text-ink-faint">
                The actual numbers behind the charts above — one row per domain, for this filter.
              </p>
            </div>
            {stats.domainBreakdown.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-faint">No domains in this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-faint">
                      <th className="px-4 py-2 font-medium">Domain</th>
                      <th className="px-4 py-2 text-right font-medium">Reports</th>
                      <th className="px-4 py-2 text-right font-medium">Message volume</th>
                      <th className="px-4 py-2 text-right font-medium">Pass rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.domainBreakdown.map((d) => (
                      <tr key={d.name} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 text-ink">{d.name}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-ink-muted">{d.reportCount}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-ink">
                          {formatCompact(d.volume)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-ink-muted">
                          {d.passRatePct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
