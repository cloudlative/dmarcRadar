"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Spinner } from "@/components/Spinner";

interface Report {
  id: string;
  orgName: string;
  reportId: string;
  dateRangeBegin: string;
  dateRangeEnd: string;
  sourceType: "UPLOAD" | "EMAIL";
  domain: { name: string };
  _count: { records: number };
}

interface Domain {
  id: string;
  name: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainId, setDomainId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/domains")
      .then((r) => r.json())
      .then((d) => setDomains(d.domains ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (domainId) params.set("domainId", domainId);
    fetch(`/api/reports?${params}`)
      .then((r) => r.json())
      .then((d) => setReports(d.reports ?? []))
      .finally(() => setLoading(false));
  }, [domainId]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-ink">Reports</h1>

      <select
        value={domainId}
        onChange={(e) => setDomainId(e.target.value)}
        className="mb-4 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink"
      >
        <option value="">All domains</option>
        {domains.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-ink-faint">
              <th className="px-4 py-2 font-medium">Domain</th>
              <th className="px-4 py-2 font-medium">Reporter</th>
              <th className="px-4 py-2 font-medium">Report ID</th>
              <th className="px-4 py-2 font-medium">Date range</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 text-right font-medium">Records</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <Spinner className="mx-auto" />
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-faint">
                  No reports ingested yet.
                </td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-raised">
                  <td className="px-4 py-2 text-ink">
                    <Link href={`/reports/${r.id}`} className="hover:underline">
                      {r.domain.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-ink-muted">{r.orgName}</td>
                  <td className="px-4 py-2 text-ink-muted">{r.reportId}</td>
                  <td className="px-4 py-2 text-ink-muted">
                    {format(new Date(r.dateRangeBegin), "MMM d")} –{" "}
                    {format(new Date(r.dateRangeEnd), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-2 text-ink-muted">
                    {r.sourceType === "UPLOAD" ? "Manual upload" : "Email"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-ink">{r._count.records}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
