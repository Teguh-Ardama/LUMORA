import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/operator"];
const AUTH_PAGES = ["/login", "/register"];

/**
 * Edge gate: presence-of-cookie routing only. Real verification happens
 * server-side on every API call — this just keeps anonymous users off
 * app pages and logged-in users off auth pages.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("lumora_refresh");

  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !hasSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (AUTH_PAGES.some((p) => pathname === p) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/operator/:path*", "/login", "/register"],
};
