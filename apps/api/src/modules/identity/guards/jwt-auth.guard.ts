import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../../../common/decorators/public.decorator.js";
import { TokenService } from "../services/token.service.js";
import type { AuthenticatedUser } from "../identity.types.js";

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/**
 * Global guard (SAD-001 Volume-2 §3, Stage 1 — Identity Service
 * Authentication). Registered as APP_GUARD in AppModule, so every route
 * requires a valid access token by default; `@Public()` is the only opt-out
 * (per its own doc comment, established ahead of this guard's implementation
 * specifically so omission fails closed, not open).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException("Authentication required");
    }

    const payload = this.tokenService.verifyAccessToken(token);
    request.user = {
      userId: payload.sub,
      workspaceId: payload.workspaceId,
      role: payload.role,
      emailVerified: payload.emailVerified,
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
