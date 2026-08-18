import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions, requireAdminSession, ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";

const updateMailboxSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  folder: z.string().min(1).optional(),
  pollIntervalMinutes: z.number().int().min(1).max(1440).optional(),
  enabled: z.boolean().optional(),
});

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  requireAdminSession(session);
  return session!;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await ensureAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw err;
  }

  const body = await request.json();
  const parsed = updateMailboxSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { password, ...rest } = parsed.data;
  try {
    const mailbox = await prisma.mailboxConfig.update({
      where: { id: params.id },
      data: { ...rest, ...(password ? { passwordEncrypted: encryptSecret(password) } : {}) },
    });
    // uidValidity is a BigInt (not JSON-serializable) and purely internal poll-tracking state.
    const { passwordEncrypted, uidValidity, ...safeMailbox } = mailbox;
    return NextResponse.json({ mailbox: safeMailbox });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "A mailbox with that name already exists" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await ensureAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw err;
  }

  await prisma.mailboxConfig.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
