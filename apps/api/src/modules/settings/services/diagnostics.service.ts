import { Injectable } from "@nestjs/common";
import { HealthCheckService } from "../../../health/health-check.service.js";
import { WhatsAppIntegrationService } from "./whatsapp-integration.service.js";
import { WhatsAppConnectionStatus } from "../../communication/schemas/whatsapp-connection.schema.js";
import type { DiagnosticsSummary } from "../settings.types.js";

/** PRD-006 Volume-4 §4.7 — read-only (BR-008). Composes the platform-level HealthCheckService (same for every workspace) with Volume-3's workspace-specific WhatsApp status. */
@Injectable()
export class DiagnosticsService {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly whatsAppIntegrationService: WhatsAppIntegrationService,
  ) {}

  async getDiagnostics(workspaceId: string): Promise<DiagnosticsSummary> {
    const [checks, whatsapp] = await Promise.all([
      this.healthCheckService.getChecks(),
      this.whatsAppIntegrationService.getSummary(workspaceId),
    ]);

    const whatsappUp = whatsapp.connected && whatsapp.status !== WhatsAppConnectionStatus.ERROR;

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
    };
  }
}
