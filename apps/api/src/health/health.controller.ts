import { Controller, Get, Version, VERSION_NEUTRAL } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator.js";
import { HealthCheckService } from "./health-check.service.js";

/**
 * Unauthenticated liveness/readiness endpoint — required by the Docker/Nginx
 * deployment model (TAD-001 §17) to determine whether a container instance is
 * ready to receive traffic. Deliberately outside the Identity/Workspace
 * pipeline (SAD-001 Volume-2 §3) since it must respond even before those are up.
 *
 * Version-neutral (VERSION_NEUTRAL): resolves to /api/health, not /api/v1/health.
 * Infrastructure checks (Docker HEALTHCHECK, Nginx upstream checks, container
 * orchestrator probes) need one stable path that never breaks when the API
 * moves to v2 — confirmed by actually curling the endpoint and finding the
 * default URI-versioned route wasn't where any deployment tooling would expect it.
 */
interface HealthResponse {
  status: "ok" | "degraded";
  database: string;
  timestamp: string;
}

@Controller("health")
export class HealthController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  // Database-only, same shape as before this volume — infra/container
  // probes depend on this exact response, extended checks live behind
  // authenticated /settings/diagnostics instead (PRD-006 Volume-4 §4.7).
  @Public()
  @Version(VERSION_NEUTRAL)
  @Get()
  check(): HealthResponse {
    const isConnected = this.healthCheckService.checkDatabase();

    return {
      status: isConnected ? "ok" : "degraded",
      database: isConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };
  }
}
