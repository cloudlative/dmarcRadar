import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, requireUserSession, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  try {
    requireUserSession(session);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }

  const { searchParams } = new URL(request.url);
  const domainId = searchParams.get("domainId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const reports = await prisma.report.findMany({
    where: {
      domainId: domainId || undefined,
      dateRangeBegin: from ? { gte: new Date(from) } : undefined,
      dateRangeEnd: to ? { lte: new Date(to) } : undefined,
    },
    include: {
      domain: true,
      _count: { select: { records: true } },
    },
    orderBy: { dateRangeBegin: "desc" },
    take: 200,
  });

  return NextResponse.json({ reports });
}
