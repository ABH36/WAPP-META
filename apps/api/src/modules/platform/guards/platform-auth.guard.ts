import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { PlatformTokenService } from "../services/platform-token.service.js";
import type { AuthenticatedPlatformUser } from "../platform.types.js";

export interface RequestWithPlatformUser extends Request {
  platformUser?: AuthenticatedPlatformUser;
}

/**
 * PRD-007 Volume-1 §6 — the platform-side equivalent of `JwtAuthGuard`,
 * deliberately not reusing it. Every Platform controller marks itself
 * `@Public()` first (to bypass the tenant `JwtAuthGuard`, which is a
 * global `APP_GUARD` and would otherwise run on every route in the app —
 * confirmed by reading `apps/api/src/modules/identity/guards/jwt-auth.
 * guard.ts`) and then applies this guard directly via `@UseGuards`. A
 * tenant access token is never accepted here — `PlatformTokenService`
 * verifies against `platformJwt`'s own secret, so a tenant JWT fails
 * signature verification outright, not just a role check. See
 * docs/ADR-PLAT-002-platform-identity-strategy.md.
 */
@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(private readonly tokenService: PlatformTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithPlatformUser>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException("Platform authentication required");
    }

    const payload = this.tokenService.verifyAccessToken(token);
    request.platformUser = {
      platformUserId: payload.sub,
      role: payload.role,
    };
    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return null;
    }
    return header.slice("Bearer ".length).trim() || null;
  }
}
