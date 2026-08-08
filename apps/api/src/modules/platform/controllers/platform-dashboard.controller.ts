import { Controller, Get, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { PlatformDashboardService } from "../services/platform-dashboard.service.js";
import type { PlatformDashboardSnapshot } from "../services/platform-dashboard.service.js";

/** §4.2/§9 — GET /platform/dashboard. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/dashboard", version: "1" })
export class PlatformDashboardController {
  constructor(private readonly platformDashboardService: PlatformDashboardService) {}

  @RequirePlatformPermission(PlatformPermission.VIEW_PLATFORM_DASHBOARD)
  @Get()
  async getSnapshot(): Promise<PlatformDashboardSnapshot> {
    return this.platformDashboardService.getSnapshot();
  }
}
