import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import { PlatformAnnouncementsService } from "../services/platform-announcements.service.js";
import { CreateAnnouncementDto } from "../dto/create-announcement.dto.js";
import type { AuthenticatedPlatformUser, PlatformAnnouncementSummary } from "../platform.types.js";

/** §4.4/§9 — POST /platform/announcements. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/announcements", version: "1" })
export class PlatformAnnouncementsController {
  constructor(private readonly platformAnnouncementsService: PlatformAnnouncementsService) {}

  @RequirePlatformPermission(PlatformPermission.MANAGE_ANNOUNCEMENTS)
  @Post()
  async create(
    @Body() dto: CreateAnnouncementDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<PlatformAnnouncementSummary> {
    return this.platformAnnouncementsService.create({
      title: dto.title,
      message: dto.message,
      targetType: dto.targetType,
      targetPlanIds: dto.targetPlanIds ?? [],
      targetWorkspaceIds: dto.targetWorkspaceIds ?? [],
      createdBy: user.platformUserId,
    });
  }

  @RequirePlatformPermission(PlatformPermission.MANAGE_ANNOUNCEMENTS)
  @Get()
  async list(): Promise<PlatformAnnouncementSummary[]> {
    return this.platformAnnouncementsService.list();
  }
}
