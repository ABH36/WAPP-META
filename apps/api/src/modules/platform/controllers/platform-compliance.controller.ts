import { Controller, Get, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { PlatformComplianceService } from "../services/platform-compliance.service.js";
import type { PlatformComplianceSnapshot } from "../platform.types.js";

/** §4.4/§9 — GET /platform/compliance, Super-Admin-only (VIEW_COMPLIANCE). */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/compliance", version: "1" })
export class PlatformComplianceController {
  constructor(private readonly platformComplianceService: PlatformComplianceService) {}

  @RequirePlatformPermission(PlatformPermission.VIEW_COMPLIANCE)
  @Get()
  async getSnapshot(): Promise<PlatformComplianceSnapshot> {
    return this.platformComplianceService.getSnapshot();
  }
}
