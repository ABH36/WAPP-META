import { Controller, Get, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { PlatformAnalyticsService } from "../services/platform-analytics.service.js";
import type { PlatformAnalyticsSnapshot } from "../platform.types.js";

/** §4.1/§9 — GET /platform/analytics. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/analytics", version: "1" })
export class PlatformAnalyticsController {
  constructor(private readonly platformAnalyticsService: PlatformAnalyticsService) {}

  @RequirePlatformPermission(PlatformPermission.VIEW_PLATFORM_ANALYTICS)
  @Get()
  async getSnapshot(): Promise<PlatformAnalyticsSnapshot> {
    return this.platformAnalyticsService.getSnapshot();
  }
}
