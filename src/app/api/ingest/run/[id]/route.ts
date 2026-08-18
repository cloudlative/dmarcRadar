import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, requireAdminSession, ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { pollMailbox } from "@/lib/imap/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  try {
    requireAdminSession(session);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw err;
  }

  const config = await prisma.mailboxConfig.findUnique({ where: { id: params.id } });
  if (!config) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  try {
    const summary = await pollMailbox(config);
    return NextResponse.json({ summary });
  } catch (err) {
    logger.error({ err, mailboxId: params.id }, "manual single-mailbox poll failed");
    return NextResponse.json({ error: "Poll failed — check the mailbox credentials and connection." }, { status: 500 });
  }
}
