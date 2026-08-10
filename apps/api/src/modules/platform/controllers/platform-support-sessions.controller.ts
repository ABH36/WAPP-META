import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import {
  ListSupportSessionsResult,
  PlatformSupportSessionsService,
} from "../services/platform-support-sessions.service.js";
import { EndSupportSessionDto } from "../dto/end-support-session.dto.js";
import { ListSupportSessionsQueryDto } from "../dto/list-support-sessions-query.dto.js";
import type { AuthenticatedPlatformUser, SupportSessionSummary } from "../platform.types.js";

const BREAK_GLASS_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

/** §4.2/§9 — POST /platform/support/sessions/:id/start, POST /platform/support/sessions/:id/end, GET /platform/support/sessions. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/support/sessions", version: "1" })
export class PlatformSupportSessionsController {
  constructor(private readonly platformSupportSessionsService: PlatformSupportSessionsService) {}

  @RequirePlatformPermission(PlatformPermission.START_SUPPORT_SESSION)
  @Throttle(BREAK_GLASS_THROTTLE)
  @Post(":id/start")
  async start(
    @Param("id") id: string,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<SupportSessionSummary> {
    return this.platformSupportSessionsService.start(id, user.platformUserId);
  }

  @RequirePlatformPermission(PlatformPermission.START_SUPPORT_SESSION)
  @Post(":id/end")
  async end(
    @Param("id") id: string,
    @Body() dto: EndSupportSessionDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<SupportSessionSummary> {
    return this.platformSupportSessionsService.end(id, dto.reason ?? null, user.platformUserId);
  }

  @RequirePlatformPermission(PlatformPermission.VIEW_INVESTIGATION)
  @Get()
  async list(@Query() query: ListSupportSessionsQueryDto): Promise<ListSupportSessionsResult> {
    return this.platformSupportSessionsService.list(
      { workspaceId: query.workspaceId, status: query.status },
      query.page ?? 1,
      query.limit ?? 20,
    );
  }
}
