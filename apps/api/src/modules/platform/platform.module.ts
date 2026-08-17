import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { BullModule } from "@nestjs/bullmq";
import { WorkspaceModule } from "../workspace/workspace.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { CrmModule } from "../crm/crm.module.js";
import { CommunicationModule } from "../communication/communication.module.js";
import { BillingModule } from "../billing/billing.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { HealthModule } from "../../health/health.module.js";
import { PlatformUser, PlatformUserSchema } from "./schemas/platform-user.schema.js";
import { PlatformSession, PlatformSessionSchema } from "./schemas/platform-session.schema.js";
import {
  PlatformAnnouncement,
  PlatformAnnouncementSchema,
} from "./schemas/platform-announcement.schema.js";
import {
  PlatformFeatureFlagOverride,
  PlatformFeatureFlagOverrideSchema,
} from "./schemas/platform-feature-flag-override.schema.js";
import {
  PlatformMaintenanceState,
  PlatformMaintenanceStateSchema,
} from "./schemas/platform-maintenance-state.schema.js";
import { SupportTicket, SupportTicketSchema } from "./schemas/support-ticket.schema.js";
import { SupportSession, SupportSessionSchema } from "./schemas/support-session.schema.js";
import {
  PlatformAuditEntry,
  PlatformAuditEntrySchema,
} from "./schemas/platform-audit-entry.schema.js";
import { GovernancePolicy, GovernancePolicySchema } from "./schemas/governance-policy.schema.js";
import {
  PlatformLoginHistoryEntry,
  PlatformLoginHistoryEntrySchema,
} from "./schemas/platform-login-history-entry.schema.js";
import { PlatformUserRepository } from "./repositories/platform-user.repository.js";
import { PlatformSessionRepository } from "./repositories/platform-session.repository.js";
import { PlatformAnnouncementRepository } from "./repositories/platform-announcement.repository.js";
import { PlatformFeatureFlagOverrideRepository } from "./repositories/platform-feature-flag-override.repository.js";
import { PlatformMaintenanceStateRepository } from "./repositories/platform-maintenance-state.repository.js";
import { SupportTicketRepository } from "./repositories/support-ticket.repository.js";
import { SupportSessionRepository } from "./repositories/support-session.repository.js";
import { PlatformAuditRepository } from "./repositories/platform-audit.repository.js";
import { GovernancePolicyRepository } from "./repositories/governance-policy.repository.js";
import { PlatformLoginHistoryRepository } from "./repositories/platform-login-history.repository.js";
import { PlatformPasswordService } from "./services/platform-password.service.js";
import { PlatformTokenService } from "./services/platform-token.service.js";
import { PlatformAuthService } from "./services/platform-auth.service.js";
import { PlatformUsersService } from "./services/platform-users.service.js";
import { PlatformAnnouncementsService } from "./services/platform-announcements.service.js";
import { PlatformWorkspaceRegistryService } from "./services/platform-workspace-registry.service.js";
import { PlatformDashboardService } from "./services/platform-dashboard.service.js";
import { PlatformFeatureFlagsService } from "./services/platform-feature-flags.service.js";
import { PlatformMaintenanceService } from "./services/platform-maintenance.service.js";
import { PlatformSearchService } from "./services/platform-search.service.js";
import { PlatformSubscriptionsService } from "./services/platform-subscriptions.service.js";
import { PlatformInvoicesService } from "./services/platform-invoices.service.js";
import { PlatformPaymentsService } from "./services/platform-payments.service.js";
import { PlatformBillingDashboardService } from "./services/platform-billing-dashboard.service.js";
import { PlatformSupportTicketsService } from "./services/platform-support-tickets.service.js";
import { PlatformSupportSessionsService } from "./services/platform-support-sessions.service.js";
import { PlatformAuditService } from "./services/platform-audit.service.js";
import { PlatformInvestigationService } from "./services/platform-investigation.service.js";
import { PlatformSupportWorkspaceOverviewService } from "./services/platform-support-workspace-overview.service.js";
import { PlatformGovernancePolicyService } from "./services/platform-governance-policy.service.js";
import { PlatformAnalyticsService } from "./services/platform-analytics.service.js";
import { PlatformComplianceService } from "./services/platform-compliance.service.js";
import { PlatformKpisService } from "./services/platform-kpis.service.js";
import { PlatformReportsService } from "./services/platform-reports.service.js";
import { PlatformAuthGuard } from "./guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "./guards/platform-permissions.guard.js";
import { SupportSessionGuard } from "./guards/support-session.guard.js";
import { PlatformAuditListener } from "./listeners/platform-audit.listener.js";
import { SupportSessionLifecycleProcessor } from "./queue/support-session-lifecycle.processor.js";
import { SUPPORT_SESSION_LIFECYCLE_QUEUE } from "./platform.constants.js";
import { PlatformAuthController } from "./controllers/platform-auth.controller.js";
import { PlatformUsersController } from "./controllers/platform-users.controller.js";
import { PlatformWorkspacesController } from "./controllers/platform-workspaces.controller.js";
import { PlatformDashboardController } from "./controllers/platform-dashboard.controller.js";
import { PlatformAnnouncementsController } from "./controllers/platform-announcements.controller.js";
import { PlatformFeatureFlagsController } from "./controllers/platform-feature-flags.controller.js";
import { PlatformMaintenanceController } from "./controllers/platform-maintenance.controller.js";
import { PlatformSearchController } from "./controllers/platform-search.controller.js";
import { PlatformSubscriptionsController } from "./controllers/platform-subscriptions.controller.js";
import { PlatformInvoicesController } from "./controllers/platform-invoices.controller.js";
import { PlatformPaymentsController } from "./controllers/platform-payments.controller.js";
import { PlatformBillingDashboardController } from "./controllers/platform-billing-dashboard.controller.js";
import { PlatformSupportTicketsController } from "./controllers/platform-support-tickets.controller.js";
import { PlatformSupportAccessController } from "./controllers/platform-support-access.controller.js";
import { PlatformSupportSessionsController } from "./controllers/platform-support-sessions.controller.js";
import { PlatformAuditController } from "./controllers/platform-audit.controller.js";
import { PlatformInvestigationController } from "./controllers/platform-investigation.controller.js";
import { PlatformSupportWorkspaceController } from "./controllers/platform-support-workspace.controller.js";
import { PlatformPoliciesController } from "./controllers/platform-policies.controller.js";
import { PlatformAnalyticsController } from "./controllers/platform-analytics.controller.js";
import { PlatformComplianceController } from "./controllers/platform-compliance.controller.js";
import { PlatformKpisController } from "./controllers/platform-kpis.controller.js";
import { PlatformReportsController } from "./controllers/platform-reports.controller.js";

/**
 * Platform Administration & Tenant Management (PRD-007 Volume-1) — the
 * first platform-scoped (cross-tenant), not workspace-scoped, module in
 * this codebase. Owns `platform_users`, `platform_sessions`,
 * `platform_announcements`, `platform_feature_flag_overrides`,
 * `platform_maintenance_state`. A completely separate identity/auth system
 * from tenant Identity (`PlatformUser`/`PlatformSession`/`PlatformAuthGuard`
 * — never merged, per the Architecture Review's "implemented independently"
 * instruction). Imports WorkspaceModule/IdentityModule/CrmModule/
 * CommunicationModule/BillingModule/HealthModule for the Dashboard's
 * cross-tenant aggregate reads and the Registry's Workspace writes — never
 * the other way around (Platform is the most downstream module in the
 * dependency graph). See docs/ADR-PLAT-001-platform-administration-boundary.md
 * and docs/ADR-PLAT-002-platform-identity-strategy.md.
 */
@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: PlatformUser.name, schema: PlatformUserSchema },
      { name: PlatformSession.name, schema: PlatformSessionSchema },
      { name: PlatformAnnouncement.name, schema: PlatformAnnouncementSchema },
      { name: PlatformFeatureFlagOverride.name, schema: PlatformFeatureFlagOverrideSchema },
      { name: PlatformMaintenanceState.name, schema: PlatformMaintenanceStateSchema },
      { name: SupportTicket.name, schema: SupportTicketSchema },
      { name: SupportSession.name, schema: SupportSessionSchema },
      { name: PlatformAuditEntry.name, schema: PlatformAuditEntrySchema },
      { name: GovernancePolicy.name, schema: GovernancePolicySchema },
      { name: PlatformLoginHistoryEntry.name, schema: PlatformLoginHistoryEntrySchema },
    ]),
    // PHD-001 Volume-3 §8/§9 — 5-minute sweep; count-based cleanup retains
    // ~1 day of run history. Unvalidated starting values pending §27
    // load-test results.
    BullModule.registerQueue({
      name: SUPPORT_SESSION_LIFECYCLE_QUEUE,
      defaultJobOptions: { removeOnComplete: { count: 288 }, removeOnFail: { count: 576 } },
    }),
    WorkspaceModule,
    IdentityModule,
    CrmModule,
    CommunicationModule,
    BillingModule,
    SettingsModule,
    HealthModule,
  ],
  controllers: [
    PlatformAuthController,
    PlatformUsersController,
    PlatformWorkspacesController,
    PlatformDashboardController,
    PlatformAnnouncementsController,
    PlatformFeatureFlagsController,
    PlatformMaintenanceController,
    PlatformSearchController,
    PlatformSubscriptionsController,
    PlatformInvoicesController,
    PlatformPaymentsController,
    PlatformBillingDashboardController,
    PlatformSupportTicketsController,
    PlatformSupportAccessController,
    PlatformSupportSessionsController,
    PlatformAuditController,
    PlatformInvestigationController,
    PlatformSupportWorkspaceController,
    PlatformPoliciesController,
    PlatformAnalyticsController,
    PlatformComplianceController,
    PlatformKpisController,
    PlatformReportsController,
  ],
  providers: [
    PlatformUserRepository,
    PlatformSessionRepository,
    PlatformAnnouncementRepository,
    PlatformFeatureFlagOverrideRepository,
    PlatformMaintenanceStateRepository,
    SupportTicketRepository,
    SupportSessionRepository,
    PlatformAuditRepository,
    GovernancePolicyRepository,
    PlatformLoginHistoryRepository,
    PlatformPasswordService,
    PlatformTokenService,
    PlatformAuthService,
    PlatformUsersService,
    PlatformAnnouncementsService,
    PlatformWorkspaceRegistryService,
    PlatformDashboardService,
    PlatformFeatureFlagsService,
    PlatformMaintenanceService,
    PlatformSearchService,
    PlatformSubscriptionsService,
    PlatformInvoicesService,
    PlatformPaymentsService,
    PlatformBillingDashboardService,
    PlatformSupportTicketsService,
    PlatformSupportSessionsService,
    PlatformAuditService,
    PlatformInvestigationService,
    PlatformSupportWorkspaceOverviewService,
    PlatformGovernancePolicyService,
    PlatformAnalyticsService,
    PlatformComplianceService,
    PlatformKpisService,
    PlatformReportsService,
    PlatformAuthGuard,
    PlatformPermissionsGuard,
    SupportSessionGuard,
    PlatformAuditListener,
    SupportSessionLifecycleProcessor,
  ],
})
export class PlatformModule {}
