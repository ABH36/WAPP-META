import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import {
  ListPlatformAuditResult,
  PlatformAuditService,
} from "../services/platform-audit.service.js";
import { ListPlatformAuditQueryDto } from "../dto/list-platform-audit-query.dto.js";

/** §4.4/§9 — GET /platform/audit (Global Audit Center). Unscoped browsing — never gated by SupportSessionGuard, unlike Investigation. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/audit", version: "1" })
export class PlatformAuditController {
  constructor(private readonly platformAuditService: PlatformAuditService) {}

  @RequirePlatformPermission(PlatformPermission.VIEW_GLOBAL_AUDIT)
  @Get()
  async list(@Query() query: ListPlatformAuditQueryDto): Promise<ListPlatformAuditResult> {
    return this.platformAuditService.list(
      { workspaceId: query.workspaceId, eventType: query.eventType },
      query.page ?? 1,
      query.limit ?? 50,
    );
  }
}
