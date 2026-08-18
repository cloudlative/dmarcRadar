import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions, requireAdminSession, ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  try {
    requireAdminSession(session);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw err;
  }

  const force = new URL(request.url).searchParams.get("force") === "true";

  if (force) {
    // Record rows cascade automatically via their own onDelete: Cascade on Report.
    await prisma.$transaction([
      prisma.report.deleteMany({ where: { domainId: params.id } }),
      prisma.domain.delete({ where: { id: params.id } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.domain.delete({ where: { id: params.id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      const reportCount = await prisma.report.count({ where: { domainId: params.id } });
      return NextResponse.json(
        {
          error: `Cannot delete a domain with ${reportCount} existing report${reportCount === 1 ? "" : "s"}. Delete its reports first.`,
          reportCount,
        },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
