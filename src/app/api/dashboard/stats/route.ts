import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, requireUserSession, UnauthorizedError } from "@/lib/auth";
import { getDashboardStats } from "@/lib/stats";

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

  const stats = await getDashboardStats({
    domainId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });

  return NextResponse.json(stats);
}
