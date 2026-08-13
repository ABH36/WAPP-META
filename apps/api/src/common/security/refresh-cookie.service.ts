import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CookieOptions, Request, Response } from "express";
import type { AppConfig } from "../../config/configuration.js";

/**
 * PHD-001 Volume-1 (Security Hardening) — the backend, not the frontend, now
 * owns the refresh-token cookie (amends ADR-FE-001; see identity.types.ts's
 * `IssuedTokenPair` doc comment for the full rationale). Shared by both the
 * tenant (`wapp_web_rt`) and Platform Administration (`wapp_admin_rt`) auth
 * boundaries — the cookie *name* is the only thing that differs between
 * them, and must be kept in sync with the matching constant in
 * apps/web/src/lib/auth-cookie.ts / apps/admin/src/lib/auth-cookie.ts
 * (separate deploys, so this can't be a shared import).
 */
@Injectable()
export class RefreshCookieService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private baseOptions(): CookieOptions {
    const domain = this.config.get("cookieDomain", { infer: true });
    return {
      httpOnly: true,
      // Only https carries `secure` cookies — dev (http://localhost) needs it off.
      secure: this.config.get("env", { infer: true }) === "production",
      // "lax" (not "strict") — the refresh cookie must still be sent on the
      // top-level navigation after Meta/Resend link redirects land the user
      // back on the app. Bearer-token auth (JwtAuthGuard reads only the
      // Authorization header, never a cookie) means classic CSRF doesn't
      // apply to token-bearing endpoints regardless.
      sameSite: "lax",
      path: "/",
      ...(domain ? { domain } : {}),
    };
  }

  /** Sets the refresh-token cookie. `rememberMe` false = session cookie (no Max-Age/Expires, cleared when the browser closes); true = persistent, expiring alongside the token itself. */
  set(response: Response, name: string, token: string, rememberMe: boolean, expiresAt: Date): void {
    response.cookie(name, token, {
      ...this.baseOptions(),
      ...(rememberMe ? { expires: expiresAt } : {}),
    });
  }

  clear(response: Response, name: string): void {
    response.clearCookie(name, this.baseOptions());
  }

  read(request: Request, name: string): string | undefined {
    return (request.cookies as Record<string, string | undefined> | undefined)?.[name];
  }
}
