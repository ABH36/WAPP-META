import { Injectable } from "@nestjs/common";
import { WhatsAppConnectionStatus } from "../../communication/schemas/whatsapp-connection.schema.js";
import { WhatsAppIntegrationService } from "./whatsapp-integration.service.js";
import { EmailIntegrationService } from "./email-integration.service.js";
import { WebhookService } from "./webhook.service.js";
import { IntegrationConnectionStatus } from "../schemas/integration-status.enum.js";
import type { IntegrationHealthEntry, IntegrationHealthSummary } from "../settings.types.js";

/** PRD-006 Volume-3 §4.7 — read-only, composes status from every integration sub-service. Owns no state of its own. */
@Injectable()
export class IntegrationHealthService {
  constructor(
    private readonly whatsAppIntegrationService: WhatsAppIntegrationService,
    private readonly emailIntegrationService: EmailIntegrationService,
    private readonly webhookService: WebhookService,
  ) {}

  async getHealth(workspaceId: string): Promise<IntegrationHealthSummary> {
    const [whatsapp, email, webhooks] = await Promise.all([
      this.whatsAppIntegrationService.getSummary(workspaceId),
      this.emailIntegrationService.getSummary(workspaceId),
      this.webhookService.list(workspaceId),
    ]);

    const entries: IntegrationHealthEntry[] = [
      {
        integration: "WHATSAPP",
        status: whatsapp.connected
          ? this.mapWhatsAppStatus(whatsapp.status)
          : IntegrationConnectionStatus.DISCONNECTED,
        lastSyncAt: null,
        lastError: null,
      },
      {
        integration: "EMAIL",
        status: email.status ?? IntegrationConnectionStatus.DISCONNECTED,
        lastSyncAt: email.lastTestedAt,
        lastError: email.lastError,
      },
      ...webhooks.map((webhook): IntegrationHealthEntry => ({
        integration: `WEBHOOK:${webhook.id}`,
        status: webhook.status,
        lastSyncAt: webhook.lastDeliveryAt,
        lastError: webhook.lastError,
      })),
    ];

    return { workspaceId, entries };
  }

  private mapWhatsAppStatus(status: WhatsAppConnectionStatus | null): IntegrationConnectionStatus {
    if (status === WhatsAppConnectionStatus.ERROR) {
      return IntegrationConnectionStatus.ERROR;
    }
    if (status === WhatsAppConnectionStatus.DISCONNECTED) {
      return IntegrationConnectionStatus.DISCONNECTED;
    }
    return IntegrationConnectionStatus.CONNECTED;
  }
}
