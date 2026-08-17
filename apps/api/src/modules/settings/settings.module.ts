import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BullModule } from "@nestjs/bullmq";
import { WorkspaceModule } from "../workspace/workspace.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { StorageModule } from "../../infrastructure/storage/storage.module.js";
import { CommunicationModule } from "../communication/communication.module.js";
import { CrmModule } from "../crm/crm.module.js";
import { BillingModule } from "../billing/billing.module.js";
import { HealthModule } from "../../health/health.module.js";
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
import { AuditLogEntry, AuditLogEntrySchema } from "./schemas/audit-log-entry.schema.js";
import {
  ConfigHistoryEntry,
  ConfigHistoryEntrySchema,
} from "./schemas/config-history-entry.schema.js";
import { ExportJob, ExportJobSchema } from "./schemas/export-job.schema.js";
import { RetentionPolicy, RetentionPolicySchema } from "./schemas/retention-policy.schema.js";
import { FeatureFlagState, FeatureFlagStateSchema } from "./schemas/feature-flag-state.schema.js";
import {
  PlatformFeatureOverrideState,
  PlatformFeatureOverrideStateSchema,
} from "./schemas/platform-feature-override-state.schema.js";
import { WorkspaceSettingsRepository } from "./repositories/workspace-settings.repository.js";
import { UserPreferencesRepository } from "./repositories/user-preferences.repository.js";
import { EmailIntegrationRepository } from "./repositories/email-integration.repository.js";
import { WebhookConfigRepository } from "./repositories/webhook-config.repository.js";
import { WebhookDeliveryLogRepository } from "./repositories/webhook-delivery-log.repository.js";
import { ThirdPartyAppRepository } from "./repositories/third-party-app.repository.js";
import { AuditLogRepository } from "./repositories/audit-log.repository.js";
import { ConfigHistoryRepository } from "./repositories/config-history.repository.js";
import { ExportJobRepository } from "./repositories/export-job.repository.js";
import { RetentionPolicyRepository } from "./repositories/retention-policy.repository.js";
import { FeatureFlagRepository } from "./repositories/feature-flag.repository.js";
import { PlatformFeatureOverrideRepository } from "./repositories/platform-feature-override.repository.js";
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
import { AuditLogService } from "./services/audit-log.service.js";
import { ConfigHistoryService } from "./services/config-history.service.js";
import { DataExportService } from "./services/data-export.service.js";
import { RetentionPolicyService } from "./services/retention-policy.service.js";
import { FeatureFlagsService } from "./services/feature-flags.service.js";
import { MaintenanceModeService } from "./services/maintenance-mode.service.js";
import { SystemPreferencesService } from "./services/system-preferences.service.js";
import { DiagnosticsService } from "./services/diagnostics.service.js";
import { WEBHOOK_DELIVERY_QUEUE } from "./queue/webhook-delivery.constants.js";
import { WebhookDeliveryService } from "./queue/webhook-delivery.service.js";
import { WebhookDeliveryProcessor } from "./queue/webhook-delivery.processor.js";
import { DATA_EXPORT_QUEUE } from "./queue/data-export.constants.js";
import { DataExportProcessor } from "./queue/data-export.processor.js";
import { RETENTION_CLEANUP_QUEUE } from "./queue/retention-cleanup.constants.js";
import { RetentionCleanupProcessor } from "./queue/retention-cleanup.processor.js";
import { WebhookEventListener } from "./listeners/webhook-event.listener.js";
import { AuditLogListener } from "./listeners/audit-log.listener.js";
import { ConfigHistoryListener } from "./listeners/config-history.listener.js";
import { PlatformFeatureOverrideListener } from "./listeners/platform-feature-override.listener.js";
import { SettingsController } from "./controllers/settings.controller.js";
import { UserPreferencesController } from "./controllers/user-preferences.controller.js";
import { SecuritySettingsController } from "./controllers/security-settings.controller.js";
import { IntegrationsController } from "./controllers/integrations.controller.js";
import { WebhooksController } from "./controllers/webhooks.controller.js";
import { ApiKeysController } from "./controllers/api-keys.controller.js";
import { AuditController } from "./controllers/audit.controller.js";
import { DataManagementController } from "./controllers/data-management.controller.js";
import { SystemAdminController } from "./controllers/system-admin.controller.js";

/**
 * Settings (Phase-7). Part-1 (PRD-006 Volume-1) owns `workspace_settings`
 * (branding/preferences). Part-2 (Volume-2) adds `user_preferences` and
 * orchestrates Identity for personal security actions. Part-3 (Volume-3,
 * Integrations & External Services) adds `email_integration_configs`,
 * `webhook_configs`, `webhook_delivery_logs`, `third_party_app_states` — and
 * imports CommunicationModule to orchestrate WhatsApp connection lifecycle
 * without owning any connection state itself. See
 * docs/ADR-SET-005-integration-ownership-strategy.md and
 * docs/ADR-SET-006-webhook-delivery-strategy.md.
 *
 * Part-4 (Volume-4, Audit Logs, Data Management & System Administration)
 * adds `audit_log_entries`, `config_history_entries`, `export_jobs`,
 * `retention_policies`, `feature_flag_states` — plus extends
 * `workspace_settings` with `maintenanceMode`/`defaultPagination`/
 * `exportFormat`/`dashboardRefreshInterval` (System Preferences, §4.8,
 * folded into the existing Volume-1 collection rather than a new one).
 * Imports CrmModule/BillingModule for Data Export's reuse of their
 * existing report-generation logic, and HealthModule for Diagnostics'
 * shared health-check service. See
 * docs/ADR-SET-007-audit-strategy.md and
 * docs/ADR-SET-008-maintenance-mode-strategy.md.
 */
@Module({
  imports: [
    WorkspaceModule,
    IdentityModule,
    StorageModule,
    CommunicationModule,
    CrmModule,
    BillingModule,
    HealthModule,
    MongooseModule.forFeature([
      { name: WorkspaceSettings.name, schema: WorkspaceSettingsSchema },
      { name: UserPreferences.name, schema: UserPreferencesSchema },
      { name: EmailIntegrationConfig.name, schema: EmailIntegrationConfigSchema },
      { name: WebhookConfig.name, schema: WebhookConfigSchema },
      { name: WebhookDeliveryLog.name, schema: WebhookDeliveryLogSchema },
      { name: ThirdPartyAppState.name, schema: ThirdPartyAppStateSchema },
      { name: AuditLogEntry.name, schema: AuditLogEntrySchema },
      { name: ConfigHistoryEntry.name, schema: ConfigHistoryEntrySchema },
      { name: ExportJob.name, schema: ExportJobSchema },
      { name: RetentionPolicy.name, schema: RetentionPolicySchema },
      { name: FeatureFlagState.name, schema: FeatureFlagStateSchema },
      { name: PlatformFeatureOverrideState.name, schema: PlatformFeatureOverrideStateSchema },
    ]),
    // PHD-001 Volume-3 §8/§9 — count-based cleanup retention, unvalidated
    // starting values pending §27 load-test results.
    BullModule.registerQueue(
      {
        name: WEBHOOK_DELIVERY_QUEUE,
        defaultJobOptions: { removeOnComplete: { count: 500 }, removeOnFail: { count: 2000 } },
      },
      {
        name: DATA_EXPORT_QUEUE,
        defaultJobOptions: { removeOnComplete: { count: 100 }, removeOnFail: { count: 500 } },
      },
      {
        name: RETENTION_CLEANUP_QUEUE,
        defaultJobOptions: { removeOnComplete: { count: 24 }, removeOnFail: { count: 48 } },
      },
    ),
  ],
  controllers: [
    SettingsController,
    UserPreferencesController,
    SecuritySettingsController,
    IntegrationsController,
    WebhooksController,
    ApiKeysController,
    AuditController,
    DataManagementController,
    SystemAdminController,
  ],
  providers: [
    WorkspaceSettingsRepository,
    UserPreferencesRepository,
    EmailIntegrationRepository,
    WebhookConfigRepository,
    WebhookDeliveryLogRepository,
    ThirdPartyAppRepository,
    AuditLogRepository,
    ConfigHistoryRepository,
    ExportJobRepository,
    RetentionPolicyRepository,
    FeatureFlagRepository,
    PlatformFeatureOverrideRepository,
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
    AuditLogService,
    ConfigHistoryService,
    DataExportService,
    RetentionPolicyService,
    FeatureFlagsService,
    MaintenanceModeService,
    SystemPreferencesService,
    DiagnosticsService,
    WebhookDeliveryService,
    WebhookDeliveryProcessor,
    DataExportProcessor,
    RetentionCleanupProcessor,
    WebhookEventListener,
    AuditLogListener,
    ConfigHistoryListener,
    PlatformFeatureOverrideListener,
  ],
  // SettingsService/AuditLogService exported for PRD-007 Volume-3 — Platform
  // Support's Cross-Tenant Read Access (§4.7, branding/preferences overview
  // only) and Investigation Timeline (§4.5, composing Settings' existing
  // workspace-scoped Audit Logs) delegate through these rather than
  // reaching into WorkspaceSettingsRepository/AuditLogRepository directly.
  // See docs/ADR-PLAT-005-platform-support-break-glass-boundary.md.
  // ExportJobRepository/FeatureFlagRepository/RetentionPolicyRepository
  // additionally exported for PRD-007 Volume-4 — the Compliance Dashboard's
  // "Export Jobs"/"Data Retention Status" widgets and the Feature Adoption
  // KPI each need one new cross-tenant aggregate read
  // (countByStatusAcrossWorkspaces/findAll/countEnabledAcrossWorkspaces),
  // the same additive-export-widening pattern Billing used in Volume-2. See
  // docs/ADR-PLAT-008-platform-analytics-strategy.md.
  exports: [
    SettingsService,
    AuditLogService,
    ExportJobRepository,
    FeatureFlagRepository,
    RetentionPolicyRepository,
  ],
})
export class SettingsModule {}
