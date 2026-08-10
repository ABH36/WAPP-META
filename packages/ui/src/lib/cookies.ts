/**
 * FRD-001 Volume-1 §8/§9 — minimal browser-cookie helpers. The backend issues
 * tokens in the JSON response body, never via `Set-Cookie` (it has no notion
 * of a frontend origin) — the frontend chooses to mirror the refresh token
 * into a plain (non-httpOnly) cookie itself, specifically so Next.js
 * middleware can read it for route-redirect purposes. This is not a security
 * boundary — the cookie is exactly as readable to XSS as localStorage would
 * be, and real authorization is always re-checked by the backend on every
 * request (BR-002/BR-004) — it exists purely so client-side route gating
 * (Protected/Guest Routes) has something to inspect server-side, at the edge,
 * before a page renders.
 */
/**
 * FRD-001 Volume-2 §4.1 — `maxAgeSeconds` is optional: omitting it sets a
 * session cookie (no `Max-Age`), cleared when the browser closes — the
 * mechanism "Remember Me" is built on (there is no backend-side hook for
 * it at all, confirmed by Architecture Review, 2026-08-10 — it's purely
 * this storage-persistence choice).
 */
export function setCookie(name: string, value: string, maxAgeSeconds?: number): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  const maxAge = maxAgeSeconds !== undefined ? `; Max-Age=${maxAgeSeconds}` : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/${maxAge}; SameSite=Lax${secure}`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0`;
}
