import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration.js";
import { PlatformUserRepository } from "../repositories/platform-user.repository.js";
import { PlatformSessionRepository } from "../repositories/platform-session.repository.js";
import { PlatformLoginHistoryRepository } from "../repositories/platform-login-history.repository.js";
import { PlatformPasswordService } from "./platform-password.service.js";
import { PlatformTokenService } from "./platform-token.service.js";
import type { PlatformUserDocument } from "../schemas/platform-user.schema.js";
import type { IssuedPlatformTokenPair, PlatformUserProfile } from "../platform.types.js";

export interface PlatformRequestMeta {
  userAgent: string | null;
  ipAddress: string | null;
}

// Fixed dummy hash compared against on a not-found login lookup — same
// user-enumeration mitigation as the tenant AuthService. Not a real
// credential.
const DUMMY_PASSWORD_HASH = "$2b$12$K.KuXIGE9EN3ottgrPQCPOB9piOJ1/oDsbD2O7Qxb9W.l67tV5dPm";

export function toPlatformUserProfile(user: PlatformUserDocument): PlatformUserProfile {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * PRD-007 Volume-1 §6 — a completely independent login/session system from
 * the tenant `AuthService`. No self-service registration (Platform Users
 * are provisioned by a PLATFORM_SUPER_ADMIN, see `PlatformUsersService`),
 * no email verification, no password-reset self-service in this volume —
 * all deliberate scope trims for a small, internal-staff-only user base.
 * See docs/ADR-PLAT-002-platform-identity-strategy.md.
 */
@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly platformUserRepository: PlatformUserRepository,
    private readonly sessionRepository: PlatformSessionRepository,
    private readonly loginHistoryRepository: PlatformLoginHistoryRepository,
    private readonly passwordService: PlatformPasswordService,
    private readonly tokenService: PlatformTokenService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async login(
    email: string,
    password: string,
    meta: PlatformRequestMeta,
    rememberMe: boolean,
  ): Promise<{ tokens: IssuedPlatformTokenPair; user: PlatformUserProfile }> {
    const user = await this.platformUserRepository.findByEmail(email, { withPassword: true });
    if (!user) {
      await this.passwordService.compare(password, DUMMY_PASSWORD_HASH);
      await this.recordLoginAttempt(null, email, false, "INVALID_CREDENTIALS", meta);
      throw new UnauthorizedException("Invalid email or password");
    }

    // PHD-001 Volume-1 (Security Hardening) — mirrors tenant AuthService.login()'s
    // exact lockout check/response, using the same shared `auth` config values.
    // Previously absent — Platform Admin accounts (highest privilege in the
    // system) had only the 5-req/min rate limiter as brute-force defense.
    const { maxFailedLoginAttempts, accountLockoutMinutes } = this.config.get("auth", {
      infer: true,
    });
    const userId = user._id.toString();

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordLoginAttempt(userId, email, false, "ACCOUNT_LOCKED", meta);
      throw new ForbiddenException(
        "This account is temporarily locked due to multiple failed login attempts. Please try again later.",
      );
    }

    const passwordMatches = await this.passwordService.compare(password, user.passwordHash);
    if (!passwordMatches) {
      await this.platformUserRepository.registerFailedLogin(
        userId,
        maxFailedLoginAttempts,
        accountLockoutMinutes,
      );
      await this.recordLoginAttempt(userId, email, false, "INVALID_CREDENTIALS", meta);
      throw new UnauthorizedException("Invalid email or password");
    }

    if (!user.isActive) {
      await this.recordLoginAttempt(user._id.toString(), email, false, "ACCOUNT_INACTIVE", meta);
      throw new ForbiddenException("This platform account has been disabled.");
    }

    await this.platformUserRepository.recordSuccessfulLogin(user._id.toString());
    await this.recordLoginAttempt(user._id.toString(), email, true, null, meta);
    const tokens = await this.issueTokenPair(user, meta, rememberMe);
    return { tokens, user: toPlatformUserProfile(user) };
  }

  /** §4.4 (Compliance Dashboard, "Failed Login Attempts"/"Platform Logins") — insert-only, mirrors tenant AuthService's own `recordLoginAttempt` exactly (same signature shape, same call sites). */
  private async recordLoginAttempt(
    platformUserId: string | null,
    email: string,
    success: boolean,
    reason: string | null,
    meta: PlatformRequestMeta,
  ): Promise<void> {
    await this.loginHistoryRepository.record({
      platformUserId,
      email,
      success,
      reason,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async refresh(
    rawRefreshToken: string,
    meta: PlatformRequestMeta,
  ): Promise<IssuedPlatformTokenPair> {
    const payload = this.tokenService.verifyRefreshToken(rawRefreshToken);
    const session = await this.sessionRepository.findByJti(payload.jti);

    if (!session) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (session.revokedAt) {
      // Reuse of an already-rotated/revoked refresh token — same theft
      // signal as the tenant AuthService, same response: revoke everything.
      await this.sessionRepository.revokeAllForUser(session.platformUserId.toString());
      throw new UnauthorizedException(
        "This session is no longer valid. For your security, all sessions have been signed out — please log in again.",
      );
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expired, please log in again");
    }

    const user = await this.platformUserRepository.findById(session.platformUserId.toString());
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const rotated = await this.createSession(user._id.toString(), meta, session.rememberMe);
    await this.sessionRepository.revokeByJti(payload.jti, rotated.jti);

    const { token: accessToken, expiresIn } = this.tokenService.signAccessToken({
      sub: user._id.toString(),
      role: user.role,
    });

    return {
      accessToken,
      refreshToken: rotated.token,
      expiresIn,
      refreshTokenExpiresAt: rotated.expiresAt,
      rememberMe: session.rememberMe,
    };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    try {
      const payload = this.tokenService.verifyRefreshToken(rawRefreshToken);
      await this.sessionRepository.revokeByJti(payload.jti);
    } catch {
      // Logout is idempotent — an already-invalid/expired token is not an error.
    }
  }

  private async issueTokenPair(
    user: PlatformUserDocument,
    meta: PlatformRequestMeta,
    rememberMe: boolean,
  ): Promise<IssuedPlatformTokenPair> {
    const session = await this.createSession(user._id.toString(), meta, rememberMe);
    const { token: accessToken, expiresIn } = this.tokenService.signAccessToken({
      sub: user._id.toString(),
      role: user.role,
    });
    return {
      accessToken,
      refreshToken: session.token,
      expiresIn,
      refreshTokenExpiresAt: session.expiresAt,
      rememberMe,
    };
  }

  private async createSession(
    platformUserId: string,
    meta: PlatformRequestMeta,
    rememberMe: boolean,
  ): Promise<{ token: string; jti: string; expiresAt: Date }> {
    const { token, jti, expiresAt } = this.tokenService.signRefreshToken(platformUserId);
    await this.sessionRepository.create({
      platformUserId,
      jti,
      rememberMe,
      tokenHash: this.tokenService.hashOpaqueToken(token),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    });
    return { token, jti, expiresAt };
  }
}
