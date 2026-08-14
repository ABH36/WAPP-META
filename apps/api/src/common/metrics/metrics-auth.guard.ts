import { timingSafeEqual } from "node:crypto";
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { AppConfig } from "../../config/configuration.js";

const BEARER_PREFIX = "Bearer ";

/**
 * PHD-001 Volume-2 — protects `GET /metrics` with a static, config-time
 * shared secret (`METRICS_AUTH_TOKEN`), the standard pattern for scraper
 * endpoints that can't perform an interactive JWT login (Architecture
 * Review: "The endpoint must never be publicly accessible").
 * Timing-safe comparison — a naive `===` leaks the token's correct prefix
 * length through response-time differences, the same class of vulnerability
 * that keyed comparisons like this always need to guard against.
 */
@Injectable()
export class MetricsAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;

    if (!header || !header.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const presented = Buffer.from(header.slice(BEARER_PREFIX.length));
    const expected = Buffer.from(
      this.config.get("observability", { infer: true }).metricsAuthToken,
    );

    if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
      throw new UnauthorizedException("Invalid bearer token");
    }

    return true;
  }
}
