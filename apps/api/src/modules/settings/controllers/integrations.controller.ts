import { Body, Controller, Get, Param, ParseEnumPipe, Patch, Post } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { IntegrationsOverviewService } from "../services/integrations-overview.service.js";
import { IntegrationHealthService } from "../services/integration-health.service.js";
import { WhatsAppIntegrationService } from "../services/whatsapp-integration.service.js";
import { EmailIntegrationService } from "../services/email-integration.service.js";
import { ThirdPartyAppsService } from "../services/third-party-apps.service.js";
import { UpdateEmailIntegrationDto } from "../dto/update-email-integration.dto.js";
import { ToggleThirdPartyAppDto } from "../dto/toggle-third-party-app.dto.js";
import { ThirdPartyAppKey } from "../schemas/third-party-app.schema.js";
import type {
  EmailIntegrationSummary,
  IntegrationHealthSummary,
  IntegrationsOverview,
  ThirdPartyAppSummary,
} from "../settings.types.js";
import type {
  ConnectionSummary,
  PhoneNumberSummary,
} from "../../communication/communication.types.js";
import type { TestConnectionResult } from "../../communication/services/whatsapp-connection.service.js";

/**
 * PRD-006 Volume-3. Reuses EDIT_WORKSPACE throughout, same as every other
 * Settings controller, except WhatsApp Disconnect which reuses the
 * previously-orphaned DISCONNECT_WHATSAPP (existed since Phase-4, never
 * consumed by any endpoint until now). No PATCH endpoint exists for WhatsApp
 * config — App ID/App Secret/Webhook Verify Token are rejected as
 * workspace-configurable fields (docs/ADR-SET-005-integration-ownership-strategy.md).
 */
@Controller({ path: "settings", version: "1" })
export class IntegrationsController {
  constructor(
    private readonly integrationsOverviewService: IntegrationsOverviewService,
    private readonly integrationHealthService: IntegrationHealthService,
    private readonly whatsAppIntegrationService: WhatsAppIntegrationService,
    private readonly emailIntegrationService: EmailIntegrationService,
    private readonly thirdPartyAppsService: ThirdPartyAppsService,
  ) {}

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Get("integrations")
  async getOverview(@CurrentUser() user: AuthenticatedUser): Promise<IntegrationsOverview> {
    return this.integrationsOverviewService.getOverview(user.workspaceId!);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Get("integration-health")
  async getHealth(@CurrentUser() user: AuthenticatedUser): Promise<IntegrationHealthSummary> {
    return this.integrationHealthService.getHealth(user.workspaceId!);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Post("integrations/whatsapp/test-connection")
  async testWhatsAppConnection(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TestConnectionResult> {
    return this.whatsAppIntegrationService.testConnection(user.workspaceId!);
  }

  @RequirePermission(Permission.DISCONNECT_WHATSAPP)
  @Post("integrations/whatsapp/disconnect")
  async disconnectWhatsApp(@CurrentUser() user: AuthenticatedUser): Promise<ConnectionSummary> {
    return this.whatsAppIntegrationService.disconnect(user.workspaceId!, user.userId);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Post("integrations/whatsapp/refresh-metadata")
  async refreshWhatsAppMetadata(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ connection: ConnectionSummary; phoneNumbers: PhoneNumberSummary[] }> {
    return this.whatsAppIntegrationService.refreshMetadata(user.workspaceId!);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch("integrations/email")
  async updateEmailIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateEmailIntegrationDto,
  ): Promise<EmailIntegrationSummary> {
    return this.emailIntegrationService.updateConfig(user.workspaceId!, dto);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Post("integrations/email/test")
  async testEmailIntegration(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; error: string | null }> {
    return this.emailIntegrationService.testConnection(user.workspaceId!);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Get("integrations/apps")
  async listThirdPartyApps(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ThirdPartyAppSummary[]> {
    return this.thirdPartyAppsService.list(user.workspaceId!);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch("integrations/apps/:appKey")
  async toggleThirdPartyApp(
    @CurrentUser() user: AuthenticatedUser,
    @Param("appKey", new ParseEnumPipe(ThirdPartyAppKey)) appKey: ThirdPartyAppKey,
    @Body() dto: ToggleThirdPartyAppDto,
  ): Promise<ThirdPartyAppSummary> {
    return this.thirdPartyAppsService.setEnabled(
      user.workspaceId!,
      user.userId,
      appKey,
      dto.enabled,
    );
  }
}
