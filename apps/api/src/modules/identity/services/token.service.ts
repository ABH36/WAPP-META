import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { AppConfig } from "../../../config/configuration.js";
import type { AccessTokenPayload, RefreshTokenPayload } from "../identity.types.js";

const DURATION_UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86_400,
};

/**
 * Parses jsonwebtoken-style short durations ("15m", "30d") into seconds, for
 * the `expiresIn` field returned to clients alongside the access token.
 */
function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Unsupported duration format: "${duration}"`);
  }
  const amount = Number(match[1]);
  const unit = match[2] as string;
  const unitSeconds = DURATION_UNIT_SECONDS[unit];
  if (unitSeconds === undefined) {
    throw new Error(`Unsupported duration unit: "${unit}"`);
  }
  return amount * unitSeconds;
}

/**
 * Owns everything token-shaped: signing/verifying the two JWT types (access,
 * refresh — TAD-001 §11 AUTH-002/AUTH-003, separate secrets so a leaked
 * access-token secret can't be used to mint refresh tokens) and generating
 * the opaque, hashed single-use tokens used for email verification and
 * password reset (AUTH-004/AUTH-005). Nothing outside this service touches
 * `jsonwebtoken`/`crypto` directly.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  signAccessToken(payload: Omit<AccessTokenPayload, "type">): { token: string; expiresIn: number } {
    const { accessSecret, accessTtl } = this.config.get("jwt", { infer: true });
    const token = this.jwtService.sign(
      { ...payload, type: "access" } satisfies AccessTokenPayload,
      // PHD-001 Volume-1 — algorithm pinned explicitly rather than left to
      // the library default, so a token crafted with `alg: "none"` or an
      // asymmetric algorithm can never be accepted.
      { secret: accessSecret, expiresIn: accessTtl, algorithm: "HS256" },
    );
    return { token, expiresIn: parseDurationToSeconds(accessTtl) };
  }

  signRefreshToken(userId: string): { token: string; jti: string; expiresAt: Date } {
    const { refreshSecret, refreshTtl } = this.config.get("jwt", { infer: true });
    const jti = randomUUID();
    const token = this.jwtService.sign(
      { sub: userId, jti, type: "refresh" } satisfies RefreshTokenPayload,
      { secret: refreshSecret, expiresIn: refreshTtl, algorithm: "HS256" },
    );
    const expiresAt = new Date(Date.now() + parseDurationToSeconds(refreshTtl) * 1000);
    return { token, jti, expiresAt };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const { accessSecret } = this.config.get("jwt", { infer: true });
    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(token, {
        secret: accessSecret,
        algorithms: ["HS256"],
      });
      if (payload.type !== "access") {
        throw new UnauthorizedException("Invalid token type");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    const { refreshSecret } = this.config.get("jwt", { infer: true });
    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(token, {
        secret: refreshSecret,
        algorithms: ["HS256"],
      });
      if (payload.type !== "refresh") {
        throw new UnauthorizedException("Invalid token type");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  /** Raw, high-entropy token — the only copy ever sent to the user (via email link). */
  generateOpaqueToken(): string {
    return randomBytes(32).toString("hex");
  }

  /** One-way hash stored in place of the raw token, so a DB read can't be used as a valid link. */
  hashOpaqueToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }
}
