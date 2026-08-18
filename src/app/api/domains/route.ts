import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import {
  authOptions,
  requireAdminSession,
  requireUserSession,
  ForbiddenError,
  UnauthorizedError,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createDomainSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireUserSession(session);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }

  const domains = await prisma.domain.findMany({
    include: { _count: { select: { reports: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ domains });
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

  const body = await request.json();
  const parsed = createDomainSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const domain = await prisma.domain.create({ data: parsed.data });
  return NextResponse.json({ domain }, { status: 201 });
}
