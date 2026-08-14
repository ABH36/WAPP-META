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
  async getMetrics(@Res({ passthrough: true }) response: Response): Promise<string> {
    response.setHeader("Content-Type", this.metricsService.registry.contentType);
    return this.metricsService.registry.metrics();
  }
}
