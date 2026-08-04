import { Body, Controller, Get, Patch, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser, IssuedTokenPair } from "../../identity/identity.types.js";
import { WorkspaceService } from "../services/workspace.service.js";
import { CreateWorkspaceDto } from "../dto/create-workspace.dto.js";
import { UpdateBusinessProfileDto } from "../dto/update-business-profile.dto.js";
import { UpdateBusinessHoursDto } from "../dto/update-business-hours.dto.js";
import { UpdateNotificationSettingsDto } from "../dto/update-notification-settings.dto.js";
import type { WorkspaceProfile } from "../workspace.types.js";

@Controller({ path: "workspaces", version: "1" })
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  // Deliberately no @RequirePermission() — the caller has no role/workspace
  // yet (that's exactly what this endpoint grants them). Authentication
  // alone (the default, global JwtAuthGuard) is the correct gate here.
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkspaceDto,
    @Req() request: Request,
  ): Promise<{ workspace: WorkspaceProfile; tokens: IssuedTokenPair }> {
    return this.workspaceService.create(user.userId, dto, this.extractMeta(request));
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
    return this.workspaceService.updateBusinessProfile(user.workspaceId!, dto);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch("me/business-hours")
  async updateBusinessHours(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBusinessHoursDto,
  ): Promise<WorkspaceProfile> {
    return this.workspaceService.updateBusinessHours(user.workspaceId!, dto);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch("me/notification-settings")
  async updateNotificationSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationSettingsDto,
  ): Promise<WorkspaceProfile> {
    return this.workspaceService.updateNotificationSettings(user.workspaceId!, dto);
  }

  private extractMeta(request: Request): { userAgent: string | null; ipAddress: string | null } {
    return {
      userAgent: request.headers["user-agent"] ?? null,
      ipAddress: request.ip ?? null,
    };
  }
}
