import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { SupportSessionGuard } from "../guards/support-session.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { PlatformInvestigationService } from "../services/platform-investigation.service.js";
import { InvestigationQueryDto } from "../dto/investigation-query.dto.js";
import type { InvestigationTimelineEntry } from "../platform.types.js";

const DEFAULT_LIMIT = 25;

/** §4.5/§9/§4.7 — GET /platform/investigation. Requires an active Support Session for the target workspace (SupportSessionGuard). */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard, SupportSessionGuard)
@Controller({ path: "platform/investigation", version: "1" })
export class PlatformInvestigationController {
  constructor(private readonly platformInvestigationService: PlatformInvestigationService) {}

  @RequirePlatformPermission(PlatformPermission.VIEW_INVESTIGATION)
  @Get()
  async getTimeline(@Query() query: InvestigationQueryDto): Promise<InvestigationTimelineEntry[]> {
    return this.platformInvestigationService.getTimeline(
      query.workspaceId,
      query.limit ?? DEFAULT_LIMIT,
    );
  }
}
