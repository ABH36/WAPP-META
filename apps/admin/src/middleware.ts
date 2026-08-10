import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_TOKEN_COOKIE } from "./lib/auth-cookie";

/**
 * FRD-001 Volume-1 §8 — unlike apps/web, this console has no public marketing
 * surface at all (AHD-001, PRD-007 — "never public-facing"). Every route is
 * protected except `/login` itself. Same UX-convenience-only caveat as
 * apps/web's middleware — presence-only check, backend remains authoritative.
 */
const GUEST_ONLY_PATHS = ["/login"];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(REFRESH_TOKEN_COOKIE);

  if (GUEST_ONLY_PATHS.includes(pathname)) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
