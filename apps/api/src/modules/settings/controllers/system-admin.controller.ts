import { Body, Controller, Get, Param, ParseEnumPipe, Patch } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { FeatureFlagsService } from "../services/feature-flags.service.js";
import { MaintenanceModeService } from "../services/maintenance-mode.service.js";
import { DiagnosticsService } from "../services/diagnostics.service.js";
import { SystemPreferencesService } from "../services/system-preferences.service.js";
import { ToggleFeatureFlagDto } from "../dto/toggle-feature-flag.dto.js";
import { UpdateMaintenanceModeDto } from "../dto/update-maintenance-mode.dto.js";
import { UpdateSystemPreferencesDto } from "../dto/update-system-preferences.dto.js";
import { FeatureFlagKey } from "../schemas/feature-flag-state.schema.js";
import type {
  DiagnosticsSummary,
  FeatureFlagSummary,
  SystemPreferencesSummary,
} from "../settings.types.js";

/**
 * PRD-006 Volume-4 §4.5/§4.6/§4.7/§4.8. Feature Flags/Maintenance/System
 * Preferences reuse EDIT_WORKSPACE. Diagnostics reuses VIEW_REPORTS
 * (read-only infra health, not the security-sensitive surface Audit Logs
 * is — see AuditController for why that one was tightened instead).
 */
@Controller({ path: "settings", version: "1" })
export class SystemAdminController {
  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly maintenanceModeService: MaintenanceModeService,
    private readonly diagnosticsService: DiagnosticsService,
    private readonly systemPreferencesService: SystemPreferencesService,
  ) {}

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Get("feature-flags")
  async listFeatureFlags(@CurrentUser() user: AuthenticatedUser): Promise<FeatureFlagSummary[]> {
    return this.featureFlagsService.list(user.workspaceId!);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch("feature-flags/:flagKey")
  async toggleFeatureFlag(
    @CurrentUser() user: AuthenticatedUser,
    @Param("flagKey", new ParseEnumPipe(FeatureFlagKey)) flagKey: FeatureFlagKey,
    @Body() dto: ToggleFeatureFlagDto,
  ): Promise<FeatureFlagSummary> {
    return this.featureFlagsService.setEnabled(
      user.workspaceId!,
      user.userId,
      flagKey,
      dto.enabled,
    );
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch("maintenance")
  async updateMaintenanceMode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMaintenanceModeDto,
  ): Promise<{ enabled: boolean }> {
    const enabled = await this.maintenanceModeService.setEnabled(
      user.workspaceId!,
      user.userId,
      dto.enabled,
    );
    return { enabled };
  }

  @RequirePermission(Permission.VIEW_REPORTS)
  @Get("diagnostics")
  async getDiagnostics(@CurrentUser() user: AuthenticatedUser): Promise<DiagnosticsSummary> {
    return this.diagnosticsService.getDiagnostics(user.workspaceId!);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Get("system-preferences")
  async getSystemPreferences(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SystemPreferencesSummary> {
    return this.systemPreferencesService.get(user.workspaceId!);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch("system-preferences")
  async updateSystemPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSystemPreferencesDto,
  ): Promise<SystemPreferencesSummary> {
    return this.systemPreferencesService.update(user.workspaceId!, user.userId, dto);
  }
}
