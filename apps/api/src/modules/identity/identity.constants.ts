// PHD-001 Volume-1 — must stay in sync with apps/web/src/lib/auth-cookie.ts's
// REFRESH_TOKEN_COOKIE constant (separate deploys, can't be a shared import).
// Shared by every controller that issues/rotates a tenant session
// (AuthController, WorkspaceController, TeamController).
export const TENANT_REFRESH_TOKEN_COOKIE = "wapp_web_rt";
