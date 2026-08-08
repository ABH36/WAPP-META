import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PlatformUserRepository } from "../repositories/platform-user.repository.js";
import { PlatformSessionRepository } from "../repositories/platform-session.repository.js";
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
    private readonly passwordService: PlatformPasswordService,
    private readonly tokenService: PlatformTokenService,
  ) {}

  async login(
    email: string,
    password: string,
    meta: PlatformRequestMeta,
  ): Promise<{ tokens: IssuedPlatformTokenPair; user: PlatformUserProfile }> {
    const user = await this.platformUserRepository.findByEmail(email, { withPassword: true });
    if (!user) {
      await this.passwordService.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException("Invalid email or password");
    }

    const passwordMatches = await this.passwordService.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (!user.isActive) {
      throw new ForbiddenException("This platform account has been disabled.");
    }

    await this.platformUserRepository.recordSuccessfulLogin(user._id.toString());
    const tokens = await this.issueTokenPair(user, meta);
    return { tokens, user: toPlatformUserProfile(user) };
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

    const rotated = await this.createSession(user._id.toString(), meta);
    await this.sessionRepository.revokeByJti(payload.jti, rotated.jti);

    const { token: accessToken, expiresIn } = this.tokenService.signAccessToken({
      sub: user._id.toString(),
      role: user.role,
    });

    return { accessToken, refreshToken: rotated.token, expiresIn };
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
  ): Promise<IssuedPlatformTokenPair> {
    const session = await this.createSession(user._id.toString(), meta);
    const { token: accessToken, expiresIn } = this.tokenService.signAccessToken({
      sub: user._id.toString(),
      role: user.role,
    });
    return { accessToken, refreshToken: session.token, expiresIn };
  }

  private async createSession(
    platformUserId: string,
    meta: PlatformRequestMeta,
  ): Promise<{ token: string; jti: string }> {
    const { token, jti, expiresAt } = this.tokenService.signRefreshToken(platformUserId);
    await this.sessionRepository.create({
      platformUserId,
      jti,
      tokenHash: this.tokenService.hashOpaqueToken(token),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    });
    return { token, jti };
  }
}
