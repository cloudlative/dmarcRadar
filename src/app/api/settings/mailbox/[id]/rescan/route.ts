import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, requireAdminSession, ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Clears the IMAP UID checkpoint so the next poll re-scans the folder from the start,
// including messages already seen/opened — the poller only ever tracks progress by UID
// (see lib/imap/client.ts), so it otherwise never revisits mail behind that checkpoint even
// after its ingested report/domain data has been deleted from the app.
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

  await prisma.mailboxConfig.update({
    where: { id: params.id },
    data: { lastUid: null, uidValidity: null },
  });

  return NextResponse.json({ ok: true });
}
