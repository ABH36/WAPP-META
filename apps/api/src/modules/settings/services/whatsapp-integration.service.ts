import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WhatsAppConnectionService } from "../../communication/services/whatsapp-connection.service.js";
import type { TestConnectionResult } from "../../communication/services/whatsapp-connection.service.js";
import type {
  ConnectionSummary,
  PhoneNumberSummary,
} from "../../communication/communication.types.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { IntegrationDisconnectedPayload } from "../../../common/events/domain-events.js";
import type { WhatsAppIntegrationSummary } from "../settings.types.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

/**
 * PRD-006 Volume-3 §4.1 — thin orchestration over
 * WhatsAppConnectionService, same shape as ADR-SET-004's
 * SecuritySettingsService -> AuthService. Settings owns none of the
 * connection state; App ID/App Secret/Webhook Verify Token are rejected as
 * workspace-configurable fields entirely (see
 * docs/ADR-SET-005-integration-ownership-strategy.md) — there is
 * deliberately no `updateConfig` method here.
 */
@Injectable()
export class WhatsAppIntegrationService {
  constructor(
    private readonly whatsAppConnectionService: WhatsAppConnectionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {}

  async getSummary(workspaceId: string): Promise<WhatsAppIntegrationSummary> {
    const connection = await this.whatsAppConnectionService.getConnection(workspaceId);
    return {
      connected: connection !== null,
      wabaId: connection?.wabaId ?? null,
      businessName: connection?.businessName ?? null,
      status: connection?.status ?? null,
    };
  }

  async testConnection(workspaceId: string): Promise<TestConnectionResult> {
    return this.whatsAppConnectionService.testConnection(workspaceId);
  }

  async disconnect(workspaceId: string, actorId: string): Promise<ConnectionSummary> {
    const result = await this.whatsAppConnectionService.disconnect(workspaceId);
    this.eventEmitter.emit(DomainEvent.INTEGRATION_DISCONNECTED, {
      workspaceId,
      integrationType: "WHATSAPP",
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies IntegrationDisconnectedPayload);
    this.metricsService.settingsIntegrationsTotal.inc({ action: "disconnected" });
    return result;
  }

  async refreshMetadata(
    workspaceId: string,
  ): Promise<{ connection: ConnectionSummary; phoneNumbers: PhoneNumberSummary[] }> {
    return this.whatsAppConnectionService.refreshMetadata(workspaceId);
  }
}
