import { Controller, Get, Res, UseGuards, Version, VERSION_NEUTRAL } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../decorators/public.decorator.js";
import { MetricsService } from "./metrics.service.js";
import { MetricsAuthGuard } from "./metrics-auth.guard.js";

/**
 * PHD-001 Volume-2 — Prometheus text-exposition-format endpoint. `@Public()`
 * bypasses the global JWT guard (a scraper can't hold a user session) but
 * `MetricsAuthGuard` still gates every request behind the `METRICS_AUTH_TOKEN`
 * shared secret — never the same thing as unauthenticated (Architecture
 * Review: "must never be publicly accessible"). Version-neutral, same
 * reasoning as `HealthController`: infra/scraper tooling needs one stable
 * path that survives a future API version bump.
 */
@Controller("metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @UseGuards(MetricsAuthGuard)
  @Version(VERSION_NEUTRAL)
  @Get()
  // FINAL-QA-001 — `@Res()` without `passthrough: true`, and `response.send()`
  // instead of a `return` value. The app's global `ResponseInterceptor`
  // (`APP_INTERCEPTOR`, every route, no exemptions) wraps every controller
  // return value in `{success, message, data}` — with `passthrough: true`,
  // that still applied here even though the header was set to
  // `text/plain`, so the actual response body was JSON-wrapped Prometheus
  // text: correct Content-Type, unparseable content, meaning a real
  // Prometheus scraper could never actually read this endpoint. Full
  // manual response control (no `passthrough`) is Nest's own documented
  // way to opt a single route out of the interceptor pipeline for the
  // body, without touching the interceptor or any other route.
  async getMetrics(@Res() response: Response): Promise<void> {
    response.setHeader("Content-Type", this.metricsService.registry.contentType);
    response.send(await this.metricsService.registry.metrics());
  }
}
