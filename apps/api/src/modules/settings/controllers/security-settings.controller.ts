import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import type {
  AuthenticatedUser,
  LoginHistorySummary,
  SessionSummary,
} from "../../identity/identity.types.js";
import { SecuritySettingsService } from "../services/security-settings.service.js";
import { ChangePasswordDto } from "../dto/change-password.dto.js";

/**
 * PRD-006 Volume-2 §4.5-§4.7/§8/§11. Self-scoped, authentication only — same
 * reasoning as UserPreferencesController. Every route is a thin
 * orchestration call into `AuthService` (Identity remains the sole owner —
 * §11); nothing here reads or writes Password/Session/Login History data
 * directly. See docs/ADR-SET-004-identity-orchestration-strategy.md.
 */
@Controller({ path: "settings/security", version: "1" })
export class SecuritySettingsController {
  constructor(private readonly securitySettingsService: SecuritySettingsService) {}

  @HttpCode(HttpStatus.OK)
  @Post("change-password")
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.securitySettingsService.changePassword(
      user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: "Password changed. You've been signed out of all other sessions." };
  }

  @Get("sessions")
  async listSessions(@CurrentUser() user: AuthenticatedUser): Promise<SessionSummary[]> {
    return this.securitySettingsService.listSessions(user.userId);
  }

  @Delete("sessions")
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(@CurrentUser() user: AuthenticatedUser): Promise<{ message: string }> {
    await this.securitySettingsService.revokeAllSessions(user.userId);
    return { message: "Signed out of all devices" };
  }

  @Delete("sessions/:id")
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<{ message: string }> {
    await this.securitySettingsService.revokeSession(user.userId, id);
    return { message: "Session revoked" };
  }

  @Get("login-history")
  async getLoginHistory(@CurrentUser() user: AuthenticatedUser): Promise<LoginHistorySummary[]> {
    return this.securitySettingsService.getLoginHistory(user.userId);
  }
}
