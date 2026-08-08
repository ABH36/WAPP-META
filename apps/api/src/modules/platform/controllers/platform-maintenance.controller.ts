import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import {
  PlatformMaintenanceService,
  type PlatformMaintenanceStatus,
} from "../services/platform-maintenance.service.js";
import { UpdatePlatformMaintenanceDto } from "../dto/update-platform-maintenance.dto.js";
import type { AuthenticatedPlatformUser } from "../platform.types.js";

/** §4.7/§9 — GET/PATCH /platform/maintenance. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/maintenance", version: "1" })
export class PlatformMaintenanceController {
  constructor(private readonly platformMaintenanceService: PlatformMaintenanceService) {}

  @RequirePlatformPermission(PlatformPermission.MANAGE_PLATFORM_MAINTENANCE)
  @Get()
  async getStatus(): Promise<PlatformMaintenanceStatus> {
    return this.platformMaintenanceService.getStatus();
  }

  @RequirePlatformPermission(PlatformPermission.MANAGE_PLATFORM_MAINTENANCE)
  @Patch()
  async setEnabled(
    @Body() dto: UpdatePlatformMaintenanceDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<PlatformMaintenanceStatus> {
    return this.platformMaintenanceService.setEnabled(
      dto.enabled,
      dto.reason ?? null,
      user.platformUserId,
    );
  }
}
