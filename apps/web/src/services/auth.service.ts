import { apiDelete, apiGet, apiPost } from "../lib/api";
import type { AccessTokenIssued, SessionSummary, UserProfile } from "../types/auth";

/** FRD-001 Volume-1 §9 — thin, typed wrappers over `apps/api`'s `/auth/*` (mirrors `AuthController` exactly, apps/api/src/modules/identity/controllers/auth.controller.ts). No business logic here — a request/response shape mapping only. */
export const authService = {
  login(
    email: string,
    password: string,
    rememberMe: boolean,
  ): Promise<{ tokens: AccessTokenIssued; user: UserProfile }> {
    return apiPost("/auth/login", { email, password, rememberMe });
  },

  register(input: {
    fullName: string;
    email: string;
    mobileNumber: string;
    password: string;
  }): Promise<{ email: string; message: string }> {
    return apiPost("/auth/register", input);
  },

  verifyEmail(token: string): Promise<{ tokens: AccessTokenIssued; user: UserProfile }> {
    return apiPost("/auth/verify-email", { token });
  },

  resendVerification(email: string): Promise<{ message: string }> {
    return apiPost("/auth/resend-verification", { email });
  },

  forgotPassword(email: string): Promise<{ message: string }> {
    return apiPost("/auth/forgot-password", { email });
  },

  resetPassword(token: string, password: string): Promise<{ message: string }> {
    return apiPost("/auth/reset-password", { token, password });
  },

  // PHD-001 Volume-1 — no refreshToken param: the backend reads/clears the
  // httpOnly cookie itself.
  logout(): Promise<{ message: string }> {
    return apiPost("/auth/logout");
  },

  me(): Promise<UserProfile> {
    return apiGet("/auth/me");
  },

  logoutAll(): Promise<{ message: string }> {
    return apiPost("/auth/logout-all");
  },

  /** FRD-001 Volume-2 §4.5. No `isCurrent` field on any returned session — see types/auth.ts. */
  sessions(): Promise<SessionSummary[]> {
    return apiGet("/auth/sessions");
  },

  revokeSession(id: string): Promise<{ message: string }> {
    return apiDelete(`/auth/sessions/${id}`);
  },
};
