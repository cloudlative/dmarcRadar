/**
 * Generates a realistic spread of DMARC aggregate reports for UI/demo validation:
 * multiple domains, reporters, source IPs (legit + suspicious), disposition/SPF/DKIM
 * mixes, and dates spread across the last ~90 days. Safe to re-run — reports are
 * deduped by the same (reportId, orgName, domainId) key the app uses everywhere else.
 *
 * Usage: npm run seed:demo
 */
import { storeReport } from "../src/lib/dmarc/store";
import { prisma } from "../src/lib/prisma";
import type { ParsedReport, ParsedRecord, AuthResultValue } from "../src/lib/dmarc/parse";

const DOMAINS = ["example.com", "acmecorp.io", "northwind-shop.com", "globex-industries.net"];

const REPORTERS = [
  "google.com",
  "outlook.com",
  "yahoo.com",
  "amazonses.com",
  "mail.ru",
  "protonmail.com",
];

// Legitimate sending infrastructure per domain — mostly passes.
const LEGIT_SOURCES = [
  "35.190.247.10",
  "35.190.247.11",
  "40.92.90.15",
  "40.92.90.16",
  "54.240.27.3",
  "192.0.2.44",
  "198.51.100.5",
];

// Unfamiliar/spoofing-shaped sources — mostly fails.
const SUSPECT_SOURCES = [
  "185.220.101.7",
  "45.155.204.63",
  "103.42.196.11",
  "203.0.113.99",
  "91.219.237.5",
];

let seedCounter = 0;
function seededRandom(): number {
  // Deterministic-ish PRNG so re-runs are reproducible-ish without relying on Math.random timing.
  seedCounter += 1;
  const x = Math.sin(seedCounter * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(seededRandom() * arr.length)];
}

function weightedAuthResult(passWeight: number): AuthResultValue {
  return seededRandom() < passWeight ? "pass" : "fail";
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildRecord(domain: string, legit: boolean): ParsedRecord {
  const sourceIp = legit ? pick(LEGIT_SOURCES) : pick(SUSPECT_SOURCES);
  const passWeight = legit ? 0.94 : 0.08;
  const dkimResult = weightedAuthResult(passWeight);
  const spfResult = weightedAuthResult(passWeight);
  const aligned = dkimResult === "pass" || spfResult === "pass";
  const disposition = aligned ? "none" : seededRandom() < 0.6 ? "quarantine" : "reject";

  return {
    sourceIp,
    count: Math.floor(seededRandom() * (legit ? 400 : 40)) + 1,
    disposition,
    dkimResult,
    spfResult,
    headerFrom: domain,
    envelopeFrom: `bounce.${domain}`,
    dkimDomain: aligned ? domain : pick(["random-relay.net", "unrelated-sender.org"]),
    dkimSelector: "selector1",
    dkimAuthResult: dkimResult,
    spfDomain: aligned ? domain : pick(["random-relay.net", "unrelated-sender.org"]),
    spfAuthResult: spfResult,
  };
}

function buildReport(domain: string, dayOffset: number, index: number): ParsedReport {
  const begin = daysAgo(dayOffset + 1);
  const end = daysAgo(dayOffset);
  const recordCount = Math.floor(seededRandom() * 6) + 3;

  const records: ParsedRecord[] = Array.from({ length: recordCount }, (_, i) =>
    buildRecord(domain, seededRandom() < 0.75 || i === 0)
  );

  return {
    orgName: pick(REPORTERS),
    email: "noreply-dmarc-support@reporter.example",
    reportId: `demo-${domain}-${dayOffset}-${index}`,
    dateRangeBegin: begin,
    dateRangeEnd: end,
    policyDomain: domain,
    policyAdkim: "r",
    policyAspf: "r",
    policyP: pick(["none", "quarantine", "reject"]),
    policySp: pick(["none", "quarantine", "reject"]),
    policyPct: 100,
    records,
  };
}

async function main() {
  let created = 0;
  let skipped = 0;

  for (const domain of DOMAINS) {
    // A handful of reports per day across the last 90 days, thinning out further back.
    for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
      const reportsThisDay = dayOffset < 14 ? 2 : seededRandom() < 0.4 ? 1 : 0;
      for (let i = 0; i < reportsThisDay; i++) {
        const parsed = buildReport(domain, dayOffset, i);
        const sourceType = seededRandom() < 0.7 ? "EMAIL" : "UPLOAD";
        const result = await storeReport(parsed, sourceType);
        if (result.created) created += 1;
        else skipped += 1;
      }
    }
  }

  console.log(`Seeded ${created} demo reports across ${DOMAINS.length} domains (${skipped} already existed).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
