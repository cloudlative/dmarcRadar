"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { DonutChart, type DonutDatum } from "@/components/DonutChart";
import { FullPageSpinner } from "@/components/Spinner";

interface Record {
  id: string;
  sourceIp: string;
  count: number;
  disposition: string;
  dkimResult: string;
  spfResult: string;
  headerFrom?: string;
}

interface ReportDetail {
  id: string;
  orgName: string;
  reportId: string;
  dateRangeBegin: string;
  dateRangeEnd: string;
  policyDomain: string;
  policyP?: string;
  policyPct?: number;
  sourceType: "UPLOAD" | "EMAIL";
  domain: { name: string };
  records: Record[];
}

function toSlices(map: Map<string, number>): DonutDatum[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

export default function ReportDetailPage({ params }: { params: { id: string } }) {
  const [report, setReport] = useState<ReportDetail | null>(null);

  useEffect(() => {
    fetch(`/api/reports/${params.id}`)
      .then((r) => r.json())
      .then((d) => setReport(d.report));
  }, [params.id]);

  const { disposition, spf, dkim, sourceIps } = useMemo(() => {
    const dispositionMap = new Map<string, number>();
    const spfMap = new Map<string, number>();
    const dkimMap = new Map<string, number>();
    const ipMap = new Map<string, number>();
    for (const r of report?.records ?? []) {
      dispositionMap.set(r.disposition, (dispositionMap.get(r.disposition) ?? 0) + r.count);
      spfMap.set(r.spfResult, (spfMap.get(r.spfResult) ?? 0) + r.count);
      dkimMap.set(r.dkimResult, (dkimMap.get(r.dkimResult) ?? 0) + r.count);
      ipMap.set(r.sourceIp, (ipMap.get(r.sourceIp) ?? 0) + r.count);
    }
    return {
      disposition: toSlices(dispositionMap),
      spf: toSlices(spfMap),
      dkim: toSlices(dkimMap),
      sourceIps: toSlices(ipMap),
    };
  }, [report]);

  if (!report) {
    return <FullPageSpinner />;
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-ink">{report.domain.name}</h1>
      <p className="mb-5 text-sm text-ink-muted">
        {report.orgName} · report {report.reportId} ·{" "}
        {format(new Date(report.dateRangeBegin), "MMM d")} –{" "}
        {format(new Date(report.dateRangeEnd), "MMM d, yyyy")} · policy p={report.policyP ?? "n/a"} (
        {report.policyPct ?? 100}%)
      </p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DonutChart title="Disposition" data={disposition} />
        <DonutChart title="SPF result" data={spf} />
        <DonutChart title="DKIM result" data={dkim} />
        <DonutChart title="Source IPs" data={sourceIps} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-ink-faint">
              <th className="px-4 py-2 font-medium">Source IP</th>
              <th className="px-4 py-2 text-right font-medium">Count</th>
              <th className="px-4 py-2 font-medium">Disposition</th>
              <th className="px-4 py-2 font-medium">DKIM</th>
              <th className="px-4 py-2 font-medium">SPF</th>
              <th className="px-4 py-2 font-medium">Header From</th>
            </tr>
          </thead>
          <tbody>
            {report.records.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-ink">{r.sourceIp}</td>
                <td className="px-4 py-2 text-right tabular-nums text-ink">{r.count}</td>
                <td className="px-4 py-2 text-ink-muted">{r.disposition}</td>
                <td className="px-4 py-2 text-ink-muted">{r.dkimResult}</td>
                <td className="px-4 py-2 text-ink-muted">{r.spfResult}</td>
                <td className="px-4 py-2 text-ink-muted">{r.headerFrom ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
