import { apiGet, apiPost } from "../lib/api";
import type { IssuedTokenPair, UserProfile } from "../types/auth";

/** FRD-001 Volume-1 §9 — thin, typed wrappers over `apps/api`'s `/auth/*` (mirrors `AuthController` exactly, apps/api/src/modules/identity/controllers/auth.controller.ts). No business logic here — a request/response shape mapping only. */
export const authService = {
  login(email: string, password: string): Promise<{ tokens: IssuedTokenPair; user: UserProfile }> {
    return apiPost("/auth/login", { email, password });
  },

  register(input: {
    fullName: string;
    email: string;
    mobileNumber: string;
    password: string;
  }): Promise<{ email: string; message: string }> {
    return apiPost("/auth/register", input);
  },

  verifyEmail(token: string): Promise<{ tokens: IssuedTokenPair; user: UserProfile }> {
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

  logout(refreshToken: string): Promise<{ message: string }> {
    return apiPost("/auth/logout", { refreshToken });
  },

  me(): Promise<UserProfile> {
    return apiGet("/auth/me");
  },
};
