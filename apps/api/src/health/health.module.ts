import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { HealthCheckService } from "./health-check.service.js";

// HealthCheckService exported for PRD-006 Volume-4 — Settings' Diagnostics
// (§4.7) reuses it rather than a parallel monitoring implementation.
@Module({
  controllers: [HealthController],
  providers: [HealthCheckService],
  exports: [HealthCheckService],
})
export class HealthModule {}
