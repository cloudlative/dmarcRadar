import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, requireAdminSession, ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { extractXml, parseDmarcXml } from "@/lib/dmarc/parse";
import { storeReport } from "@/lib/dmarc/store";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const ALLOWED_EXTENSIONS = [".xml", ".gz", ".zip"];

interface FileResult {
  filename: string;
  status: "created" | "duplicate" | "error";
  message?: string;
  recordCount?: number;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  try {
    requireAdminSession(session);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw err;
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const results: FileResult[] = [];

  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      results.push({ filename: file.name, status: "error", message: "Unsupported file type" });
      continue;
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const xml = extractXml(buffer, file.name);
      const parsed = parseDmarcXml(xml);
      const result = await storeReport(parsed, "UPLOAD", xml);
      results.push({
        filename: file.name,
        status: result.created ? "created" : "duplicate",
        recordCount: result.recordCount,
      });
    } catch (err) {
      logger.error({ err, filename: file.name }, "failed to process uploaded DMARC report");
      results.push({
        filename: file.name,
        status: "error",
        message: err instanceof Error ? err.message : "Unknown parsing error",
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: "upload",
      target: files.map((f) => f.name).join(", "),
    },
  });

  return NextResponse.json({ results });
}
