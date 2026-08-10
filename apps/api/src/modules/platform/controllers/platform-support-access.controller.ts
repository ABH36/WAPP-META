import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import { PlatformSupportSessionsService } from "../services/platform-support-sessions.service.js";
import { RequestSupportAccessDto } from "../dto/request-support-access.dto.js";
import type { AuthenticatedPlatformUser, SupportSessionSummary } from "../platform.types.js";

// Security requirement (Architecture Review, 2026-08-10) — reuse the same
// highest-tier throttle already applied to Platform Auth and payment
// operations (SEC-009, 5 requests/minute).
const BREAK_GLASS_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

/** §4.1/§9 — POST /platform/support/access/request, PATCH /platform/support/access/:id/approve. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/support/access", version: "1" })
export class PlatformSupportAccessController {
  constructor(private readonly platformSupportSessionsService: PlatformSupportSessionsService) {}

  @RequirePlatformPermission(PlatformPermission.REQUEST_SUPPORT_ACCESS)
  @Throttle(BREAK_GLASS_THROTTLE)
  @Post("request")
  async request(
    @Body() dto: RequestSupportAccessDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<SupportSessionSummary> {
    return this.platformSupportSessionsService.request(
      dto.workspaceId,
      dto.reason,
      dto.durationMinutes,
      user.platformUserId,
    );
  }

  @RequirePlatformPermission(PlatformPermission.APPROVE_SUPPORT_ACCESS)
  @Throttle(BREAK_GLASS_THROTTLE)
  @Patch(":id/approve")
  async approve(
    @Param("id") id: string,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<SupportSessionSummary> {
    return this.platformSupportSessionsService.approve(id, user.platformUserId);
  }
}
