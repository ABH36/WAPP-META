import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { ApiKeyService } from "../services/api-key.service.js";

export interface ApiKeyContext {
  apiKeyId: string;
  workspaceId: string;
  scope: string;
}

export interface RequestWithApiKey extends Request {
  apiKeyContext?: ApiKeyContext;
}

/**
 * PRD-006 Volume-3 §4.4 — validates the `x-api-key` header against
 * ApiKeyService, attaching `request.apiKeyContext` (mirrors JwtAuthGuard's
 * `request.user`, kept as a distinct field since an API-key caller is not a
 * logged-in User). Not registered as a global APP_GUARD — every route is
 * still JWT-only by default; apply with `@UseGuards(ApiKeyGuard)`
 * route-by-route once a Developer API surface exists to protect (§12/TD-019
 * territory, out of scope for this volume).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithApiKey>();
    const rawKey = request.headers["x-api-key"];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!key) {
      throw new UnauthorizedException("API key required");
    }

    const validated = await this.apiKeyService.validate(key);
    if (!validated) {
      throw new UnauthorizedException("Invalid or expired API key");
    }

    request.apiKeyContext = validated;
    return true;
  }
}
