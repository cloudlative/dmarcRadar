import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions, requireAdminSession, ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";

const createMailboxSchema = z.object({
  name: z.string().min(1).max(255),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(993),
  secure: z.boolean().default(true),
  username: z.string().min(1),
  password: z.string().min(1),
  folder: z.string().min(1).default("INBOX"),
  pollIntervalMinutes: z.number().int().min(1).max(1440).default(15),
  enabled: z.boolean().default(true),
});

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  requireAdminSession(session);
  return session!;
}

export async function GET() {
  try {
    await ensureAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw err;
  }

  const mailboxes = await prisma.mailboxConfig.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    mailboxes: mailboxes.map(({ passwordEncrypted, ...rest }) => rest),
  });
}

export async function POST(request: Request) {
  try {
    await ensureAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw err;
  }

  const body = await request.json();
  const parsed = createMailboxSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { password, ...rest } = parsed.data;
  try {
    const mailbox = await prisma.mailboxConfig.create({
      data: { ...rest, passwordEncrypted: encryptSecret(password) },
    });
    const { passwordEncrypted, ...safeMailbox } = mailbox;
    return NextResponse.json({ mailbox: safeMailbox }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "A mailbox with that name already exists" }, { status: 409 });
    }
    throw err;
  }
}
