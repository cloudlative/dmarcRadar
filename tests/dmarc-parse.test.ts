import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import AdmZip from "adm-zip";
import { parseDmarcXml, parseDmarcAttachment, extractXml } from "@/lib/dmarc/parse";

const fixturesDir = path.join(__dirname, "fixtures");
const passXml = fs.readFileSync(path.join(fixturesDir, "sample-pass.xml"), "utf8");
const mixedXml = fs.readFileSync(path.join(fixturesDir, "sample-mixed.xml"), "utf8");

describe("parseDmarcXml", () => {
  it("parses a single-record passing report", () => {
    const report = parseDmarcXml(passXml);
    expect(report.orgName).toBe("google.com");
    expect(report.reportId).toBe("10001001");
    expect(report.policyDomain).toBe("example.com");
    expect(report.records).toHaveLength(1);
    expect(report.records[0]).toMatchObject({
      sourceIp: "203.0.113.10",
      count: 25,
      disposition: "none",
      dkimResult: "pass",
      spfResult: "pass",
    });
    expect(report.dateRangeBegin.getTime()).toBe(1735689600 * 1000);
  });

  it("parses a multi-record mixed pass/fail report", () => {
    const report = parseDmarcXml(mixedXml);
    expect(report.records).toHaveLength(2);
    const [rejected, passed] = report.records;
    expect(rejected.disposition).toBe("reject");
    expect(rejected.dkimResult).toBe("fail");
    expect(rejected.spfResult).toBe("fail");
    expect(passed.dkimResult).toBe("pass");
    expect(passed.spfResult).toBe("fail");
    expect(passed.count).toBe(12);
  });

  it("throws on malformed XML missing required fields", () => {
    expect(() => parseDmarcXml("<feedback></feedback>")).toThrow();
  });
});

describe("extractXml / parseDmarcAttachment", () => {
  it("unwraps a gzip-compressed report", () => {
    const gz = zlib.gzipSync(Buffer.from(passXml, "utf8"));
    const xml = extractXml(gz, "report.xml.gz");
    expect(xml).toContain("<feedback>");
    const report = parseDmarcAttachment(gz, "report.xml.gz");
    expect(report.reportId).toBe("10001001");
  });

  it("unwraps a zip-compressed report", () => {
    const zip = new AdmZip();
    zip.addFile("report.xml", Buffer.from(mixedXml, "utf8"));
    const buf = zip.toBuffer();
    const report = parseDmarcAttachment(buf, "report.zip");
    expect(report.reportId).toBe("20002002");
    expect(report.records).toHaveLength(2);
  });

  it("passes through plain xml", () => {
    const report = parseDmarcAttachment(Buffer.from(passXml, "utf8"), "report.xml");
    expect(report.orgName).toBe("google.com");
  });
});
