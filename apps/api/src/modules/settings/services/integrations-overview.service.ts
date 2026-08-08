import { Injectable } from "@nestjs/common";
import { WhatsAppIntegrationService } from "./whatsapp-integration.service.js";
import { EmailIntegrationService } from "./email-integration.service.js";
import { WebhookService } from "./webhook.service.js";
import { SettingsApiKeysService } from "./settings-api-keys.service.js";
import { ThirdPartyAppsService } from "./third-party-apps.service.js";
import { ApiKeyStatus } from "../../identity/schemas/api-key.schema.js";
import type { IntegrationsOverview } from "../settings.types.js";

/** §2/§9 GET /settings/integrations — the "centralized configuration" summary. Composes every integration sub-service, owns nothing itself. */
@Injectable()
export class IntegrationsOverviewService {
  constructor(
    private readonly whatsAppIntegrationService: WhatsAppIntegrationService,
    private readonly emailIntegrationService: EmailIntegrationService,
    private readonly webhookService: WebhookService,
    private readonly apiKeysService: SettingsApiKeysService,
    private readonly thirdPartyAppsService: ThirdPartyAppsService,
  ) {}

  async getOverview(workspaceId: string): Promise<IntegrationsOverview> {
    const [whatsapp, email, webhooks, apiKeys, thirdPartyApps] = await Promise.all([
      this.whatsAppIntegrationService.getSummary(workspaceId),
      this.emailIntegrationService.getSummary(workspaceId),
      this.webhookService.list(workspaceId),
      this.apiKeysService.list(workspaceId),
      this.thirdPartyAppsService.list(workspaceId),
    ]);

    return {
      workspaceId,
      whatsapp,
      email,
      webhookCount: webhooks.length,
      apiKeyCount: apiKeys.filter((key) => key.status === ApiKeyStatus.ACTIVE).length,
      thirdPartyApps,
    };
  }
}
