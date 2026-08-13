import { createHash, randomUUID } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { AppConfig } from "../../../config/configuration.js";
import type { PlatformAccessTokenPayload, PlatformRefreshTokenPayload } from "../platform.types.js";

const DURATION_UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86_400,
};

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
 * PRD-007 Volume-1 — mirrors Identity's `TokenService` exactly (same
 * duration-parsing helper, same verify/sign shape), but signs/verifies
 * against `platformJwt`'s own secret pair, never the tenant `jwt` secrets,
 * and every payload carries a `"platform_access"`/`"platform_refresh"`
 * type discriminator distinct from the tenant `"access"`/`"refresh"`
 * values. Deliberately not shared with Identity's `TokenService` — see
 * docs/ADR-PLAT-002-platform-identity-strategy.md.
 */
@Injectable()
export class PlatformTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  signAccessToken(payload: Omit<PlatformAccessTokenPayload, "type">): {
    token: string;
    expiresIn: number;
  } {
    const { accessSecret, accessTtl } = this.config.get("platformJwt", { infer: true });
    const token = this.jwtService.sign(
      { ...payload, type: "platform_access" } satisfies PlatformAccessTokenPayload,
      // PHD-001 Volume-1 — algorithm pinned explicitly rather than left to
      // the library default, so a token crafted with `alg: "none"` or an
      // asymmetric algorithm can never be accepted.
      { secret: accessSecret, expiresIn: accessTtl, algorithm: "HS256" },
    );
    return { token, expiresIn: parseDurationToSeconds(accessTtl) };
  }

  signRefreshToken(platformUserId: string): { token: string; jti: string; expiresAt: Date } {
    const { refreshSecret, refreshTtl } = this.config.get("platformJwt", { infer: true });
    const jti = randomUUID();
    const token = this.jwtService.sign(
      { sub: platformUserId, jti, type: "platform_refresh" } satisfies PlatformRefreshTokenPayload,
      { secret: refreshSecret, expiresIn: refreshTtl, algorithm: "HS256" },
    );
    const expiresAt = new Date(Date.now() + parseDurationToSeconds(refreshTtl) * 1000);
    return { token, jti, expiresAt };
  }

  verifyAccessToken(token: string): PlatformAccessTokenPayload {
    const { accessSecret } = this.config.get("platformJwt", { infer: true });
    try {
      const payload = this.jwtService.verify<PlatformAccessTokenPayload>(token, {
        secret: accessSecret,
        algorithms: ["HS256"],
      });
      if (payload.type !== "platform_access") {
        throw new UnauthorizedException("Invalid token type");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }

  verifyRefreshToken(token: string): PlatformRefreshTokenPayload {
    const { refreshSecret } = this.config.get("platformJwt", { infer: true });
    try {
      const payload = this.jwtService.verify<PlatformRefreshTokenPayload>(token, {
        secret: refreshSecret,
        algorithms: ["HS256"],
      });
      if (payload.type !== "platform_refresh") {
        throw new UnauthorizedException("Invalid token type");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  /** One-way hash stored in place of the raw refresh-token JWT, so a DB read alone can't be replayed. */
  hashOpaqueToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }
}
