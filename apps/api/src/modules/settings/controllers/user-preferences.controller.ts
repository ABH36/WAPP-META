import { Body, Controller, Get, Patch } from "@nestjs/common";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { UserPreferencesService } from "../services/user-preferences.service.js";
import { UpdatePreferencesDto } from "../dto/update-user-preferences.dto.js";
import { UpdateThemeDto } from "../dto/update-theme.dto.js";
import { UpdateDashboardDto } from "../dto/update-dashboard.dto.js";
import { UpdateNotificationsDto } from "../dto/update-notifications.dto.js";
import type { UserSettingsOverview } from "../settings.types.js";

/**
 * PRD-006 Volume-2 §8. Self-scoped — every route acts on the caller's own
 * account only, never another user's. Resolved 2026-08-07, Architecture
 * Review: authentication only (global JwtAuthGuard), no
 * `@RequirePermission()` — matches Identity's own established pattern for
 * every self-scoped account endpoint (`/auth/me`, `/auth/sessions`, etc.),
 * since every user regardless of role manages their own preferences. See
 * docs/ADR-SET-001-settings-ownership-strategy.md.
 */
@Controller({ path: "settings/user", version: "1" })
export class UserPreferencesController {
  constructor(private readonly userPreferencesService: UserPreferencesService) {}

  @Get()
  async getOverview(@CurrentUser() user: AuthenticatedUser): Promise<UserSettingsOverview> {
    return this.userPreferencesService.getOverview(user.userId, user.workspaceId!);
  }

  @Patch("preferences")
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<UserSettingsOverview> {
    return this.userPreferencesService.updatePreferences(user.userId, user.workspaceId!, dto);
  }

  @Patch("theme")
  async updateTheme(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateThemeDto,
  ): Promise<UserSettingsOverview> {
    return this.userPreferencesService.updateTheme(user.userId, user.workspaceId!, dto);
  }

  @Patch("dashboard")
  async updateDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDashboardDto,
  ): Promise<UserSettingsOverview> {
    return this.userPreferencesService.updateDashboard(user.userId, user.workspaceId!, dto);
  }

  @Patch("notifications")
  async updateNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationsDto,
  ): Promise<UserSettingsOverview> {
    return this.userPreferencesService.updateNotifications(user.userId, user.workspaceId!, dto);
  }
}
