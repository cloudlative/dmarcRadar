import { describe, it, expect } from "vitest";
import { combineDashboardStats, topN, mapSourceTypeLabel, type RawStatsInput } from "@/lib/stats";

function makeRaw(overrides: Partial<RawStatsInput>): RawStatsInput {
  return {
    totalReports: 0,
    totalVolume: 0,
    passVolume: 0,
    distinctSources: 0,
    dispositionGroups: [],
    spfGroups: [],
    dkimGroups: [],
    domainGroups: [],
    sourceIpGroups: [],
    failingSourceIpGroups: [],
    reportSourceGroups: [],
    domainBreakdown: [],
    ...overrides,
  };
}

describe("topN", () => {
  it("passes through when at or under the limit", () => {
    const map = new Map([["a", 10], ["b", 5]]);
    expect(topN(map)).toEqual([
      { label: "a", value: 10 },
      { label: "b", value: 5 },
    ]);
  });

  it("collapses entries beyond N into an Other bucket", () => {
    const map = new Map(Array.from({ length: 10 }, (_, i) => [`ip-${i}`, 10 - i] as const));
    const result = topN(map, 7);
    expect(result).toHaveLength(8);
    expect(result[7]).toEqual({ label: "Other", value: (10 - 7) + (10 - 8) + (10 - 9) });
  });

  it("omits the Other bucket when nothing overflows", () => {
    const map = new Map([["a", 1]]);
    expect(topN(map, 7)).toEqual([{ label: "a", value: 1 }]);
  });
});

describe("mapSourceTypeLabel", () => {
  it("maps UPLOAD and EMAIL to human labels", () => {
    expect(mapSourceTypeLabel("UPLOAD")).toBe("Manual upload");
    expect(mapSourceTypeLabel("EMAIL")).toBe("Email ingestion");
  });
});

describe("combineDashboardStats", () => {
  it("computes KPIs and derives pass/fail from raw sums", () => {
    const raw = makeRaw({
      totalReports: 3,
      totalVolume: 15,
      passVolume: 10,
      distinctSources: 2,
    });
    const stats = combineDashboardStats(raw);
    expect(stats.kpis).toEqual({
      totalReports: 3,
      totalVolume: 15,
      passRatePct: 66.7,
      distinctSources: 2,
    });
    expect(stats.passFail).toEqual([
      { label: "Pass", value: 10 },
      { label: "Fail", value: 5 },
    ]);
  });

  it("returns zeroed KPIs for no data", () => {
    const stats = combineDashboardStats(makeRaw({}));
    expect(stats.kpis.totalVolume).toBe(0);
    expect(stats.kpis.passRatePct).toBe(0);
    expect(stats.passFail).toEqual([
      { label: "Pass", value: 0 },
      { label: "Fail", value: 0 },
    ]);
  });

  it("applies the top-N-plus-Other cutoff to every grouped dimension", () => {
    const manyIps = Array.from({ length: 10 }, (_, i) => ({ label: `10.0.0.${i}`, value: 10 - i }));
    const raw = makeRaw({ totalVolume: 55, passVolume: 55, sourceIpGroups: manyIps });
    const stats = combineDashboardStats(raw);
    expect(stats.topSourceIps.length).toBeLessThanOrEqual(8);
    expect(stats.topSourceIps.some((s) => s.label === "Other")).toBe(true);
  });

  it("passes grouped disposition/spf/dkim/domain/report-source data straight through under the cutoff", () => {
    const raw = makeRaw({
      dispositionGroups: [{ label: "none", value: 40 }, { label: "reject", value: 5 }],
      spfGroups: [{ label: "pass", value: 40 }, { label: "fail", value: 5 }],
      dkimGroups: [{ label: "pass", value: 42 }, { label: "fail", value: 3 }],
      domainGroups: [{ label: "example.com", value: 45 }],
      reportSourceGroups: [{ label: "Email ingestion", value: 5 }, { label: "Manual upload", value: 2 }],
    });
    const stats = combineDashboardStats(raw);
    expect(stats.disposition).toEqual(raw.dispositionGroups);
    expect(stats.spfResult).toEqual(raw.spfGroups);
    expect(stats.dkimResult).toEqual(raw.dkimGroups);
    expect(stats.topDomains).toEqual(raw.domainGroups);
    expect(stats.reportSource).toEqual(raw.reportSourceGroups);
  });

  it("passes the per-domain breakdown straight through unchanged (no top-N cutoff)", () => {
    const domainBreakdown = [
      { name: "example.com", reportCount: 12, volume: 500, passRatePct: 95.5 },
      { name: "acme.io", reportCount: 3, volume: 40, passRatePct: 100 },
    ];
    const stats = combineDashboardStats(makeRaw({ domainBreakdown }));
    expect(stats.domainBreakdown).toEqual(domainBreakdown);
  });
});
