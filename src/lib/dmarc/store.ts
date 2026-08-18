import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { ParsedReport } from "@/lib/dmarc/parse";

export interface StoreResult {
  reportId: string;
  created: boolean;
  recordCount: number;
}

async function archiveRawXml(reportKey: string, xml: string): Promise<string | undefined> {
  const dir = process.env.REPORTS_STORAGE_DIR ?? "./storage/reports";
  try {
    await fs.mkdir(dir, { recursive: true });
    const safeName = reportKey.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(dir, `${safeName}.xml`);
    await fs.writeFile(filePath, xml, "utf8");
    return filePath;
  } catch (err) {
    logger.warn({ err }, "failed to archive raw DMARC xml, continuing without archive");
    return undefined;
  }
}

/**
 * Upserts a parsed DMARC report + its records. Dedupes on (reportId, orgName, domainId) —
 * re-ingesting the same report (e.g. re-polling the same mailbox) is a no-op.
 */
export async function storeReport(
  parsed: ParsedReport,
  sourceType: "UPLOAD" | "EMAIL",
  rawXml?: string
): Promise<StoreResult> {
  const domain = await prisma.domain.upsert({
    where: { name: parsed.policyDomain },
    create: { name: parsed.policyDomain },
    update: {},
  });

  const existing = await prisma.report.findUnique({
    where: {
      reportId_orgName_domainId: {
        reportId: parsed.reportId,
        orgName: parsed.orgName,
        domainId: domain.id,
      },
    },
  });

  if (existing) {
    logger.info(
      { reportId: parsed.reportId, orgName: parsed.orgName },
      "duplicate DMARC report skipped"
    );
    return { reportId: existing.id, created: false, recordCount: 0 };
  }

  const rawXmlPath = rawXml
    ? await archiveRawXml(`${parsed.orgName}-${parsed.reportId}`, rawXml)
    : undefined;

  const report = await prisma.report.create({
    data: {
      domainId: domain.id,
      orgName: parsed.orgName,
      email: parsed.email,
      reportId: parsed.reportId,
      dateRangeBegin: parsed.dateRangeBegin,
      dateRangeEnd: parsed.dateRangeEnd,
      policyDomain: parsed.policyDomain,
      policyAdkim: parsed.policyAdkim,
      policyAspf: parsed.policyAspf,
      policyP: parsed.policyP,
      policySp: parsed.policySp,
      policyPct: parsed.policyPct,
      sourceType,
      rawXmlPath,
      records: {
        create: parsed.records.map((r) => ({
          sourceIp: r.sourceIp,
          count: r.count,
          disposition: r.disposition,
          dkimResult: r.dkimResult,
          spfResult: r.spfResult,
          headerFrom: r.headerFrom,
          envelopeFrom: r.envelopeFrom,
          envelopeTo: r.envelopeTo,
          dkimDomain: r.dkimDomain,
          dkimSelector: r.dkimSelector,
          dkimAuthResult: r.dkimAuthResult,
          spfDomain: r.spfDomain,
          spfAuthResult: r.spfAuthResult,
        })),
      },
    },
  });

  logger.info(
    { reportId: report.id, domain: domain.name, records: parsed.records.length },
    "stored DMARC report"
  );

  return { reportId: report.id, created: true, recordCount: parsed.records.length };
}
