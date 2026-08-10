import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { SupportSessionGuard } from "../guards/support-session.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { PlatformSupportWorkspaceOverviewService } from "../services/platform-support-workspace-overview.service.js";
import type { SupportWorkspaceOverview } from "../platform.types.js";

/** §4.7/§9 — GET /platform/support/workspaces/:id. Requires an active Support Session for :id (SupportSessionGuard). */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard, SupportSessionGuard)
@Controller({ path: "platform/support/workspaces", version: "1" })
export class PlatformSupportWorkspaceController {
  constructor(
    private readonly platformSupportWorkspaceOverviewService: PlatformSupportWorkspaceOverviewService,
  ) {}

  @RequirePlatformPermission(PlatformPermission.VIEW_INVESTIGATION)
  @Get(":id")
  async getOverview(@Param("id") id: string): Promise<SupportWorkspaceOverview> {
    return this.platformSupportWorkspaceOverviewService.getOverview(id);
  }
}
