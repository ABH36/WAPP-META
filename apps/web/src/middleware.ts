import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_TOKEN_COOKIE } from "./lib/auth-cookie";

/**
 * FRD-001 Volume-1 §8 — "Protected Routes"/"Guest Routes". Checks only for
 * the presence of the refresh-token cookie, never its validity — the edge
 * runtime has no way to verify a JWT signature without shipping the secret
 * to a public environment, and validity is re-checked on every real API
 * call regardless. This is UX-convenience routing (BR-003's "display-only"
 * principle, extended to navigation) — the backend remains the only real
 * authorization boundary (BR-004). Route lists mirror the actual page
 * inventory DS-001 §6 already names for the Authentication module (PRD-002)
 * — not new routes invented here.
 */
const GUEST_ONLY_PATHS = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];
const PUBLIC_PATHS = ["/"];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(REFRESH_TOKEN_COOKIE);

  if (GUEST_ONLY_PATHS.includes(pathname)) {
    if (hasSession) {
      // TODO(FRD-001 Volume-3, Workspace UI): redirect to the real
      // workspace home once it exists — "/" is a placeholder target.
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname)) {
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
