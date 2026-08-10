/**
 * FRD-001 Volume-2 §4.1 — "Remember Me" has no backend hook (confirmed:
 * `LoginDto` has no `rememberMe` field, `AuthService.login()` has no
 * session-TTL branching). Persisted as a plain localStorage flag — not
 * sensitive, just a UI preference like theme/sidebar state — so every
 * subsequent silent refresh (`lib/api.ts`'s interceptor, `providers/
 * auth-provider.tsx`'s hydration) knows whether to keep re-issuing the
 * refresh-token cookie as session-only or persistent, not just the initial
 * login call.
 */
const REMEMBER_ME_KEY = "wapp_web_remember_me";
const REMEMBER_ME_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function setRememberMe(value: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(REMEMBER_ME_KEY, value ? "1" : "0");
}

export function getRememberMe(): boolean {
  if (typeof localStorage === "undefined") return true;
  // Default true: a silent refresh happening before any explicit login in
  // this browser (shouldn't occur in practice — no cookie means no refresh
  // is attempted) falls back to the more forgiving, persistent behavior.
  return localStorage.getItem(REMEMBER_ME_KEY) !== "0";
}

export function refreshTokenCookieMaxAge(): number | undefined {
  return getRememberMe() ? REMEMBER_ME_COOKIE_MAX_AGE_SECONDS : undefined;
}
