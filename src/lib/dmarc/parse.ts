import { XMLParser } from "fast-xml-parser";
import zlib from "node:zlib";
import AdmZip from "adm-zip";

export type AuthResultValue =
  | "pass"
  | "fail"
  | "softfail"
  | "neutral"
  | "none"
  | "temperror"
  | "permerror";

export interface ParsedRecord {
  sourceIp: string;
  count: number;
  disposition: "none" | "quarantine" | "reject";
  dkimResult: AuthResultValue;
  spfResult: AuthResultValue;
  headerFrom?: string;
  envelopeFrom?: string;
  envelopeTo?: string;
  dkimDomain?: string;
  dkimSelector?: string;
  dkimAuthResult?: AuthResultValue;
  spfDomain?: string;
  spfAuthResult?: AuthResultValue;
}

export interface ParsedReport {
  orgName: string;
  email?: string;
  reportId: string;
  dateRangeBegin: Date;
  dateRangeEnd: Date;
  policyDomain: string;
  policyAdkim?: string;
  policyAspf?: string;
  policyP?: string;
  policySp?: string;
  policyPct?: number;
  records: ParsedRecord[];
}

const AUTH_RESULTS = new Set([
  "pass",
  "fail",
  "softfail",
  "neutral",
  "none",
  "temperror",
  "permerror",
]);

function normalizeAuthResult(value: unknown): AuthResultValue {
  const v = String(value ?? "").toLowerCase();
  return (AUTH_RESULTS.has(v) ? v : "none") as AuthResultValue;
}

function normalizeDisposition(value: unknown): "none" | "quarantine" | "reject" {
  const v = String(value ?? "").toLowerCase();
  return v === "quarantine" || v === "reject" ? v : "none";
}

/** Unwraps an .xml, .xml.gz, or .zip attachment/upload buffer into a raw XML string. */
export function extractXml(buffer: Buffer, filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".gz")) {
    return zlib.gunzipSync(buffer).toString("utf8");
  }
  if (lower.endsWith(".zip")) {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    const xmlEntry = entries.find((e) => e.entryName.toLowerCase().endsWith(".xml")) ?? entries[0];
    if (!xmlEntry) throw new Error(`Zip archive ${filename} contains no readable entries`);
    return xmlEntry.getData().toString("utf8");
  }
  // Assume plain XML (possibly gzip-magic-byte-detect as a fallback)
  if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return zlib.gunzipSync(buffer).toString("utf8");
  }
  return buffer.toString("utf8");
}

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  isArray: (name) => name === "record",
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Parses a DMARC aggregate report XML string (RFC 7489 `feedback` schema) into a normalized shape. */
export function parseDmarcXml(xml: string): ParsedReport {
  const doc = xmlParser.parse(xml);
  const feedback = doc.feedback;
  if (!feedback) {
    throw new Error("Not a valid DMARC aggregate report: missing <feedback> root element");
  }

  const metadata = feedback.report_metadata ?? {};
  const policy = feedback.policy_published ?? {};
  const rawRecords = asArray(feedback.record);

  const records: ParsedRecord[] = rawRecords.map((r: any) => {
    const row = r.row ?? {};
    const evaluated = row.policy_evaluated ?? {};
    const identifiers = r.identifiers ?? {};
    const authResults = r.auth_results ?? {};
    const dkimAuth = asArray(authResults.dkim)[0];
    const spfAuth = asArray(authResults.spf)[0];

    return {
      sourceIp: String(row.source_ip ?? "unknown"),
      count: Number(row.count ?? 0),
      disposition: normalizeDisposition(evaluated.disposition),
      dkimResult: normalizeAuthResult(evaluated.dkim),
      spfResult: normalizeAuthResult(evaluated.spf),
      headerFrom: identifiers.header_from ? String(identifiers.header_from) : undefined,
      envelopeFrom: identifiers.envelope_from ? String(identifiers.envelope_from) : undefined,
      envelopeTo: identifiers.envelope_to ? String(identifiers.envelope_to) : undefined,
      dkimDomain: dkimAuth?.domain ? String(dkimAuth.domain) : undefined,
      dkimSelector: dkimAuth?.selector ? String(dkimAuth.selector) : undefined,
      dkimAuthResult: dkimAuth?.result ? normalizeAuthResult(dkimAuth.result) : undefined,
      spfDomain: spfAuth?.domain ? String(spfAuth.domain) : undefined,
      spfAuthResult: spfAuth?.result ? normalizeAuthResult(spfAuth.result) : undefined,
    };
  });

  const begin = Number(metadata.date_range?.begin);
  const end = Number(metadata.date_range?.end);
  if (!metadata.report_id || Number.isNaN(begin) || Number.isNaN(end) || !policy.domain) {
    throw new Error("Malformed DMARC report: missing required metadata/policy fields");
  }

  return {
    orgName: String(metadata.org_name ?? "unknown"),
    email: metadata.email ? String(metadata.email) : undefined,
    reportId: String(metadata.report_id),
    dateRangeBegin: new Date(begin * 1000),
    dateRangeEnd: new Date(end * 1000),
    policyDomain: String(policy.domain),
    policyAdkim: policy.adkim ? String(policy.adkim) : undefined,
    policyAspf: policy.aspf ? String(policy.aspf) : undefined,
    policyP: policy.p ? String(policy.p) : undefined,
    policySp: policy.sp ? String(policy.sp) : undefined,
    policyPct: policy.pct !== undefined ? Number(policy.pct) : undefined,
    records,
  };
}

/** Convenience: unwrap + parse in one call. */
export function parseDmarcAttachment(buffer: Buffer, filename: string): ParsedReport {
  const xml = extractXml(buffer, filename);
  return parseDmarcXml(xml);
}
