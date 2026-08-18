import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, requireUserSession, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  try {
    requireUserSession(session);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }

  const report = await prisma.report.findUnique({
    where: { id: params.id },
    include: { domain: true, records: true },
  });

  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ report });
}
