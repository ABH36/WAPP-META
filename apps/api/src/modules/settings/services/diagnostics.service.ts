import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration.js";
import { HealthCheckService } from "../../../health/health-check.service.js";
import { QueueStatusService } from "../../../infrastructure/queue/queue-status.service.js";
import { WhatsAppIntegrationService } from "./whatsapp-integration.service.js";
import { FeatureFlagsService } from "./feature-flags.service.js";
import { WhatsAppConnectionStatus } from "../../communication/schemas/whatsapp-connection.schema.js";
import type { DiagnosticsSummary } from "../settings.types.js";

/**
 * PRD-006 Volume-4 §4.7 — read-only (BR-008). Composes the platform-level
 * HealthCheckService (same for every workspace) with Volume-3's
 * workspace-specific WhatsApp status. PHD-001 Volume-2 §4.14 extends this
 * with build/runtime metadata, feature flags, per-queue status (via
 * QueueStatusService), and cache status — same composition-over-parallel-
 * implementation approach as the original checks.
 */
@Injectable()
export class DiagnosticsService {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly whatsAppIntegrationService: WhatsAppIntegrationService,
    private readonly queueStatusService: QueueStatusService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async getDiagnostics(workspaceId: string): Promise<DiagnosticsSummary> {
    const [checks, whatsapp, queues, cache, featureFlags] = await Promise.all([
      this.healthCheckService.getChecks(),
      this.whatsAppIntegrationService.getSummary(workspaceId),
      this.queueStatusService.getStatus(),
      this.healthCheckService.getCacheStatus(),
      this.featureFlagsService.list(workspaceId),
    ]);

    const whatsappUp = whatsapp.connected && whatsapp.status !== WhatsAppConnectionStatus.ERROR;
    const observability = this.config.get("observability", { infer: true });

    return {
      workspaceId,
      checks: [
        { name: "database", status: checks.database ? "UP" : "DOWN" },
        { name: "redis", status: checks.redis ? "UP" : "DOWN" },
        { name: "queue", status: checks.queue ? "UP" : "DOWN" },
        { name: "storage", status: checks.storage ? "UP" : "DOWN" },
        { name: "email", status: checks.email ? "UP" : "DOWN" },
        { name: "whatsapp", status: whatsappUp ? "UP" : "DOWN" },
      ],
      checkedAt: new Date().toISOString(),
      buildVersion: observability.buildVersion,
      gitCommit: observability.gitCommit,
      environment: this.config.get("env", { infer: true }),
      featureFlags,
      queues,
      cache,
      activeWorkers: queues.reduce((sum, queue) => sum + queue.workers, 0),
    };
  }
}
