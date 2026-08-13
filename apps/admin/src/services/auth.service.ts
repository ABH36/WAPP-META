import { apiGet, apiPost } from "../lib/api";
import type { PlatformAccessTokenIssued, PlatformUser, PlatformUserProfile } from "../types/auth";

/** FRD-001 Volume-1 §9 — thin, typed wrappers over `apps/api`'s `/platform/auth/*` (mirrors `PlatformAuthController` exactly, apps/api/src/modules/platform/controllers/platform-auth.controller.ts). No self-registration — Platform Users are provisioned by an existing PLATFORM_SUPER_ADMIN only (PRD-007 §4.3), so there is deliberately no `register()` here. */
export const authService = {
  login(
    email: string,
    password: string,
    rememberMe: boolean,
  ): Promise<{ tokens: PlatformAccessTokenIssued; user: PlatformUserProfile }> {
    return apiPost("/platform/auth/login", { email, password, rememberMe });
  },

  // PHD-001 Volume-1 — no refreshToken param: the backend reads/clears the
  // httpOnly cookie itself.
  logout(): Promise<{ message: string }> {
    return apiPost("/platform/auth/logout");
  },

  /** Returns only `{platformUserId, role}` — see types/auth.ts's top comment. */
  me(): Promise<PlatformUser> {
    return apiGet("/platform/auth/me");
  },
};
