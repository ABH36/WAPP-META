import { Body, Controller, Get, Patch, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import { RefreshCookieService } from "../../../common/security/refresh-cookie.service.js";
import type {
  AccessTokenIssued,
  AuthenticatedUser,
  IssuedTokenPair,
} from "../../identity/identity.types.js";
import { TENANT_REFRESH_TOKEN_COOKIE } from "../../identity/identity.constants.js";
import { WorkspaceService } from "../services/workspace.service.js";
import { CreateWorkspaceDto } from "../dto/create-workspace.dto.js";
import { UpdateBusinessProfileDto } from "../dto/update-business-profile.dto.js";
import { UpdateBusinessHoursDto } from "../dto/update-business-hours.dto.js";
import { UpdateNotificationSettingsDto } from "../dto/update-notification-settings.dto.js";
import type { WorkspaceProfile } from "../workspace.types.js";

@Controller({ path: "workspaces", version: "1" })
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly refreshCookies: RefreshCookieService,
  ) {}

  // Deliberately no @RequirePermission() — the caller has no role/workspace
  // yet (that's exactly what this endpoint grants them). Authentication
  // alone (the default, global JwtAuthGuard) is the correct gate here.
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkspaceDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ workspace: WorkspaceProfile; tokens: AccessTokenIssued }> {
    const { workspace, tokens } = await this.workspaceService.create(
      user.userId,
      dto,
      this.extractMeta(request),
    );
    this.setRefreshCookie(response, tokens);
    return { workspace, tokens: toAccessTokenIssued(tokens) };
  }

  @RequirePermission(Permission.VIEW_WORKSPACE)
  @Get("me")
  async getCurrent(@CurrentUser() user: AuthenticatedUser): Promise<WorkspaceProfile> {
    return this.workspaceService.getById(user.workspaceId!);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch("me/business-profile")
  async updateBusinessProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBusinessProfileDto,
  ): Promise<WorkspaceProfile> {
    return this.workspaceService.updateBusinessProfile(user.workspaceId!, dto, user.userId);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch("me/business-hours")
  async updateBusinessHours(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBusinessHoursDto,
  ): Promise<WorkspaceProfile> {
    return this.workspaceService.updateBusinessHours(user.workspaceId!, dto, user.userId);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch("me/notification-settings")
  async updateNotificationSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationSettingsDto,
  ): Promise<WorkspaceProfile> {
    return this.workspaceService.updateNotificationSettings(user.workspaceId!, dto, user.userId);
  }

  private setRefreshCookie(response: Response, tokens: IssuedTokenPair): void {
    this.refreshCookies.set(
      response,
      TENANT_REFRESH_TOKEN_COOKIE,
      tokens.refreshToken,
      tokens.rememberMe,
      tokens.refreshTokenExpiresAt,
    );
  }

  private extractMeta(request: Request): { userAgent: string | null; ipAddress: string | null } {
    return {
      userAgent: request.headers["user-agent"] ?? null,
      ipAddress: request.ip ?? null,
    };
  }
}

function toAccessTokenIssued(tokens: IssuedTokenPair): AccessTokenIssued {
  return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
}
