import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BullModule } from "@nestjs/bullmq";
import { WorkspaceModule } from "../workspace/workspace.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { StorageModule } from "../../infrastructure/storage/storage.module.js";
import { CommunicationModule } from "../communication/communication.module.js";
import { WorkspaceSettings, WorkspaceSettingsSchema } from "./schemas/workspace-settings.schema.js";
import { UserPreferences, UserPreferencesSchema } from "./schemas/user-preferences.schema.js";
import {
  EmailIntegrationConfig,
  EmailIntegrationConfigSchema,
} from "./schemas/email-integration.schema.js";
import { WebhookConfig, WebhookConfigSchema } from "./schemas/webhook-config.schema.js";
import {
  WebhookDeliveryLog,
  WebhookDeliveryLogSchema,
} from "./schemas/webhook-delivery-log.schema.js";
import { ThirdPartyAppState, ThirdPartyAppStateSchema } from "./schemas/third-party-app.schema.js";
import { WorkspaceSettingsRepository } from "./repositories/workspace-settings.repository.js";
import { UserPreferencesRepository } from "./repositories/user-preferences.repository.js";
import { EmailIntegrationRepository } from "./repositories/email-integration.repository.js";
import { WebhookConfigRepository } from "./repositories/webhook-config.repository.js";
import { WebhookDeliveryLogRepository } from "./repositories/webhook-delivery-log.repository.js";
import { ThirdPartyAppRepository } from "./repositories/third-party-app.repository.js";
import { SettingsService } from "./services/settings.service.js";
import { UserPreferencesService } from "./services/user-preferences.service.js";
import { SecuritySettingsService } from "./services/security-settings.service.js";
import { WhatsAppIntegrationService } from "./services/whatsapp-integration.service.js";
import { EmailIntegrationService } from "./services/email-integration.service.js";
import { WebhookService } from "./services/webhook.service.js";
import { SettingsApiKeysService } from "./services/settings-api-keys.service.js";
import { ThirdPartyAppsService } from "./services/third-party-apps.service.js";
import { IntegrationHealthService } from "./services/integration-health.service.js";
import { IntegrationsOverviewService } from "./services/integrations-overview.service.js";
import { WEBHOOK_DELIVERY_QUEUE } from "./queue/webhook-delivery.constants.js";
import { WebhookDeliveryService } from "./queue/webhook-delivery.service.js";
import { WebhookDeliveryProcessor } from "./queue/webhook-delivery.processor.js";
import { WebhookEventListener } from "./listeners/webhook-event.listener.js";
import { SettingsController } from "./controllers/settings.controller.js";
import { UserPreferencesController } from "./controllers/user-preferences.controller.js";
import { SecuritySettingsController } from "./controllers/security-settings.controller.js";
import { IntegrationsController } from "./controllers/integrations.controller.js";
import { WebhooksController } from "./controllers/webhooks.controller.js";
import { ApiKeysController } from "./controllers/api-keys.controller.js";

/**
 * Settings (Phase-7). Part-1 (PRD-006 Volume-1) owns `workspace_settings`
 * (branding/preferences). Part-2 (Volume-2) adds `user_preferences` and
 * orchestrates Identity for personal security actions. Part-3 (Volume-3,
 * Integrations & External Services) adds `email_integration_configs`,
 * `webhook_configs`, `webhook_delivery_logs`, `third_party_app_states` — and
 * imports CommunicationModule to orchestrate WhatsApp connection lifecycle
 * (Test Connection/Disconnect/Refresh Metadata) without owning any
 * connection state itself, the same pattern IdentityModule already
 * established for Part-2's Security Settings. See
 * docs/ADR-SET-005-integration-ownership-strategy.md and
 * docs/ADR-SET-006-webhook-delivery-strategy.md.
 */
@Module({
  imports: [
    WorkspaceModule,
    IdentityModule,
    StorageModule,
    CommunicationModule,
    MongooseModule.forFeature([
      { name: WorkspaceSettings.name, schema: WorkspaceSettingsSchema },
      { name: UserPreferences.name, schema: UserPreferencesSchema },
      { name: EmailIntegrationConfig.name, schema: EmailIntegrationConfigSchema },
      { name: WebhookConfig.name, schema: WebhookConfigSchema },
      { name: WebhookDeliveryLog.name, schema: WebhookDeliveryLogSchema },
      { name: ThirdPartyAppState.name, schema: ThirdPartyAppStateSchema },
    ]),
    BullModule.registerQueue({ name: WEBHOOK_DELIVERY_QUEUE }),
  ],
  controllers: [
    SettingsController,
    UserPreferencesController,
    SecuritySettingsController,
    IntegrationsController,
    WebhooksController,
    ApiKeysController,
  ],
  providers: [
    WorkspaceSettingsRepository,
    UserPreferencesRepository,
    EmailIntegrationRepository,
    WebhookConfigRepository,
    WebhookDeliveryLogRepository,
    ThirdPartyAppRepository,
    SettingsService,
    UserPreferencesService,
    SecuritySettingsService,
    WhatsAppIntegrationService,
    EmailIntegrationService,
    WebhookService,
    SettingsApiKeysService,
    ThirdPartyAppsService,
    IntegrationHealthService,
    IntegrationsOverviewService,
    WebhookDeliveryService,
    WebhookDeliveryProcessor,
    WebhookEventListener,
  ],
})
export class SettingsModule {}
