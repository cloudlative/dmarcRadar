import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ADMIN_ONLY_PREFIXES = ["/domains", "/settings", "/upload"];

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    const needsAdmin = ADMIN_ONLY_PREFIXES.some((p) => path.startsWith(p));
    if (needsAdmin && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/",
    "/reports/:path*",
    "/domains/:path*",
    "/settings/:path*",
    "/upload/:path*",
    "/profile/:path*",
  ],
};
