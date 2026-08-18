import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, requireAdminSession, ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { pollAllEnabledMailboxes } from "@/lib/imap/client";
import { logger } from "@/lib/logger";

export async function POST() {
  const session = await getServerSession(authOptions);
  try {
    requireAdminSession(session);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw err;
  }

  try {
    const summaries = await pollAllEnabledMailboxes();
    return NextResponse.json({ summaries });
  } catch (err) {
    logger.error({ err }, "manual ingest run failed");
    return NextResponse.json({ error: "Ingest run failed" }, { status: 500 });
  }
}
