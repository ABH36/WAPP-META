/** See apps/web's equivalent file for the full rationale — "Remember Me" has no backend hook, purely a client-side cookie-persistence choice. */
const REMEMBER_ME_KEY = "wapp_admin_remember_me";
const REMEMBER_ME_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function setRememberMe(value: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(REMEMBER_ME_KEY, value ? "1" : "0");
}

export function getRememberMe(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(REMEMBER_ME_KEY) !== "0";
}

export function refreshTokenCookieMaxAge(): number | undefined {
  return getRememberMe() ? REMEMBER_ME_COOKIE_MAX_AGE_SECONDS : undefined;
}
