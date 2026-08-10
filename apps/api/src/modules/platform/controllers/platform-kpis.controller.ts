import { Controller, Get, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { PlatformKpisService } from "../services/platform-kpis.service.js";
import type { PlatformKpiSnapshot } from "../platform.types.js";

/** §4.5/§9 — GET /platform/kpis. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/kpis", version: "1" })
export class PlatformKpisController {
  constructor(private readonly platformKpisService: PlatformKpisService) {}

  @RequirePlatformPermission(PlatformPermission.VIEW_PLATFORM_ANALYTICS)
  @Get()
  async getSnapshot(): Promise<PlatformKpiSnapshot> {
    return this.platformKpisService.getSnapshot();
  }
}
