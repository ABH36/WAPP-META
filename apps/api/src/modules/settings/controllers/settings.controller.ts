import { Body, Controller, Delete, Get, Patch, Post } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { SettingsService } from "../services/settings.service.js";
import { UpdatePreferencesDto } from "../dto/update-preferences.dto.js";
import { UpdateLogoDto } from "../dto/update-logo.dto.js";
import type { LogoUploadSignature, SettingsOverview } from "../settings.types.js";

/**
 * PRD-006 Volume-1. Reuses EDIT_WORKSPACE throughout (resolved 2026-08-07,
 * Architecture Review — Owner FULL, Administrator FULL, everyone else
 * NONE), including the read endpoint, rather than fragmenting the
 * permission model between a broader VIEW-level and EDIT_WORKSPACE. No
 * write endpoints exist here for Business Profile/Business Hours/
 * Notification Settings — those stay behind Workspace's own existing
 * `PATCH /v1/workspaces/me/*` endpoints, unchanged; this controller only
 * ever writes to Settings-owned data (branding, preferences). See
 * docs/ADR-SET-001-settings-ownership-strategy.md.
 */
@Controller({ path: "settings", version: "1" })
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Get()
  async getOverview(@CurrentUser() user: AuthenticatedUser): Promise<SettingsOverview> {
    return this.settingsService.getOverview(user.workspaceId!);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch("preferences")
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<SettingsOverview> {
    return this.settingsService.updatePreferences(user.workspaceId!, dto, user.userId);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Post("branding/logo/upload-signature")
  getLogoUploadSignature(@CurrentUser() user: AuthenticatedUser): LogoUploadSignature {
    return this.settingsService.getLogoUploadSignature(user.workspaceId!);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch("branding/logo")
  async updateLogo(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLogoDto,
  ): Promise<SettingsOverview> {
    return this.settingsService.updateLogo(user.workspaceId!, dto, user.userId);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Delete("branding/logo")
  async removeLogo(@CurrentUser() user: AuthenticatedUser): Promise<SettingsOverview> {
    return this.settingsService.removeLogo(user.workspaceId!, user.userId);
  }
}
