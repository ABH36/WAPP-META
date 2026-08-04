import { Controller, Get, Version, VERSION_NEUTRAL } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { ConnectionStates, type Connection } from "mongoose";
import { Public } from "../common/decorators/public.decorator.js";

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
@Controller("health")
export class HealthController {
  constructor(@InjectConnection() private readonly mongoConnection: Connection) {}

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get()
  check(): { status: "ok" | "degraded"; database: string; timestamp: string } {
    const isConnected = this.mongoConnection.readyState === ConnectionStates.connected;

    return {
      status: isConnected ? "ok" : "degraded",
      database: isConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };
  }
}
