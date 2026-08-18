import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface StatsFilter {
  domainId?: string;
  from?: Date;
  to?: Date;
}

export interface Slice {
  label: string;
  value: number;
}

export interface DashboardStats {
  kpis: {
    totalReports: number;
    totalVolume: number;
    passRatePct: number;
    distinctSources: number;
  };
  passFail: Slice[];
  disposition: Slice[];
  spfResult: Slice[];
  dkimResult: Slice[];
  topDomains: Slice[];
  topSourceIps: Slice[];
  reportSource: Slice[];
  topFailingSources: Slice[];
}

const MAX_SLICES = 7;

/** Collapses a label->value map into the top N slices plus an "Other" bucket. Pure — no DB access. */
export function topN(map: Map<string, number>, n = MAX_SLICES): Slice[] {
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n);
  const restTotal = rest.reduce((sum, [, v]) => sum + v, 0);
  const slices: Slice[] = top.map(([label, value]) => ({ label, value }));
  if (restTotal > 0) slices.push({ label: "Other", value: restTotal });
  return slices;
}

export function mapSourceTypeLabel(sourceType: string): string {
  return sourceType === "UPLOAD" ? "Manual upload" : "Email ingestion";
}

function toMap(slices: Slice[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of slices) map.set(s.label, s.value);
  return map;
}

export interface RawStatsInput {
  totalReports: number;
  totalVolume: number;
  passVolume: number;
  distinctSources: number;
  dispositionGroups: Slice[];
  spfGroups: Slice[];
  dkimGroups: Slice[];
  domainGroups: Slice[];
  sourceIpGroups: Slice[];
  failingSourceIpGroups: Slice[];
  reportSourceGroups: Slice[];
}

/**
 * Turns already-grouped SQL aggregates (see getDashboardStats) into the final chart-ready
 * shape — applying the top-N-plus-Other cutoff and deriving pass/fail from the raw sums.
 * Pure and DB-free, so it's cheap to unit test independent of Postgres.
 */
export function combineDashboardStats(raw: RawStatsInput): DashboardStats {
  const passFail: Slice[] = [
    { label: "Pass", value: raw.passVolume },
    { label: "Fail", value: raw.totalVolume - raw.passVolume },
  ];

  return {
    kpis: {
      totalReports: raw.totalReports,
      totalVolume: raw.totalVolume,
      passRatePct: raw.totalVolume > 0 ? Math.round((raw.passVolume / raw.totalVolume) * 1000) / 10 : 0,
      distinctSources: raw.distinctSources,
    },
    passFail,
    disposition: topN(toMap(raw.dispositionGroups)),
    spfResult: topN(toMap(raw.spfGroups)),
    dkimResult: topN(toMap(raw.dkimGroups)),
    topDomains: topN(toMap(raw.domainGroups)),
    topSourceIps: topN(toMap(raw.sourceIpGroups)),
    reportSource: topN(toMap(raw.reportSourceGroups)),
    topFailingSources: topN(toMap(raw.failingSourceIpGroups)),
  };
}

// All raw queries filter on Report (aliased `rep`) so the same condition list works whether
// the query joins in Record (aliased `r`) or not.
function reportConditions(filter: StatsFilter): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (filter.domainId) conditions.push(Prisma.sql`rep."domainId" = ${filter.domainId}`);
  if (filter.from) conditions.push(Prisma.sql`rep."dateRangeBegin" >= ${filter.from}`);
  if (filter.to) conditions.push(Prisma.sql`rep."dateRangeEnd" <= ${filter.to}`);
  return conditions;
}

function whereSql(conditions: Prisma.Sql[]): Prisma.Sql {
  return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
}

interface GroupRow {
  label: string;
  value: bigint;
}

/** Groups Record rows (summed by `count`) by a fixed, hardcoded column expression — never user input. */
async function groupByRecordColumn(where: Prisma.Sql, column: Prisma.Sql): Promise<Slice[]> {
  const rows = await prisma.$queryRaw<GroupRow[]>(Prisma.sql`
    SELECT ${column} AS label, SUM(r.count) AS value
    FROM "Record" r
    JOIN "Report" rep ON rep.id = r."reportId"
    ${where}
    GROUP BY ${column}
    ORDER BY value DESC
  `);
  return rows.map((row) => ({ label: row.label, value: Number(row.value) }));
}

async function groupByDomain(where: Prisma.Sql): Promise<Slice[]> {
  const rows = await prisma.$queryRaw<GroupRow[]>(Prisma.sql`
    SELECT d.name AS label, SUM(r.count) AS value
    FROM "Record" r
    JOIN "Report" rep ON rep.id = r."reportId"
    JOIN "Domain" d ON d.id = rep."domainId"
    ${where}
    GROUP BY d.name
    ORDER BY value DESC
  `);
  return rows.map((row) => ({ label: row.label, value: Number(row.value) }));
}

async function groupByReportSource(where: Prisma.Sql): Promise<Slice[]> {
  const rows = await prisma.$queryRaw<{ label: string; value: bigint }[]>(Prisma.sql`
    SELECT rep."sourceType" AS label, COUNT(*) AS value
    FROM "Report" rep
    ${where}
  GROUP BY rep."sourceType"
  `);
  return rows.map((row) => ({ label: mapSourceTypeLabel(row.label), value: Number(row.value) }));
}

/**
 * Fetches dashboard metrics with every aggregation pushed down to Postgres (GROUP BY / SUM /
 * COUNT DISTINCT) instead of pulling every matching Report+Record row into Node and reducing
 * in JS — the query result sets here are only ever a handful of grouped rows, regardless of
 * how many underlying records exist, so this stays fast as ingested data grows.
 */
export async function getDashboardStats(filter: StatsFilter): Promise<DashboardStats> {
  const conditions = reportConditions(filter);
  const where = whereSql(conditions);
  const failingWhere = whereSql([
    ...conditions,
    Prisma.sql`((r."dkimResult" <> 'pass' AND r."spfResult" <> 'pass') OR r.disposition <> 'none')`,
  ]);

  const [kpiRows, dispositionGroups, spfGroups, dkimGroups, domainGroups, sourceIpGroups, failingSourceIpGroups, reportSourceGroups] =
    await Promise.all([
      prisma.$queryRaw<{ total_reports: bigint; total_volume: bigint | null; pass_volume: bigint | null; distinct_sources: bigint }[]>(
        Prisma.sql`
          SELECT
            COUNT(DISTINCT rep.id) AS total_reports,
            COALESCE(SUM(r.count), 0) AS total_volume,
            COALESCE(SUM(CASE WHEN r."dkimResult" = 'pass' OR r."spfResult" = 'pass' THEN r.count ELSE 0 END), 0) AS pass_volume,
            COUNT(DISTINCT r."sourceIp") AS distinct_sources
          FROM "Report" rep
          LEFT JOIN "Record" r ON r."reportId" = rep.id
          ${where}
        `
      ),
      groupByRecordColumn(where, Prisma.sql`r.disposition`),
      groupByRecordColumn(where, Prisma.sql`r."spfResult"`),
      groupByRecordColumn(where, Prisma.sql`r."dkimResult"`),
      groupByDomain(where),
      groupByRecordColumn(where, Prisma.sql`r."sourceIp"`),
      groupByRecordColumn(failingWhere, Prisma.sql`r."sourceIp"`),
      groupByReportSource(where),
    ]);

  const kpiRow = kpiRows[0];

  return combineDashboardStats({
    totalReports: Number(kpiRow?.total_reports ?? 0),
    totalVolume: Number(kpiRow?.total_volume ?? 0),
    passVolume: Number(kpiRow?.pass_volume ?? 0),
    distinctSources: Number(kpiRow?.distinct_sources ?? 0),
    dispositionGroups,
    spfGroups,
    dkimGroups,
    domainGroups,
    sourceIpGroups,
    failingSourceIpGroups,
    reportSourceGroups,
  });
}
