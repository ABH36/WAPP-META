import { Controller, Get, Query } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { AuditLogService } from "../services/audit-log.service.js";
import { ConfigHistoryService } from "../services/config-history.service.js";
import { AuditLogQueryDto } from "../dto/audit-log-query.dto.js";
import { PageQueryDto } from "../dto/page-query.dto.js";
import type { AuditLogPage, ConfigHistoryEntrySummary } from "../settings.types.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;

/**
 * PRD-006 Volume-4 §4.1/§4.2. Audit Logs use EDIT_WORKSPACE (Owner/
 * Administrator only, resolved 2026-08-08, Architecture Review — the
 * broader VIEW_REPORTS proposed in §7 was rejected given the
 * security-sensitive actor/IP/device data this surface exposes).
 * Configuration History reuses EDIT_WORKSPACE too, consistent with every
 * other Settings write-adjacent surface.
 */
@Controller({ path: "settings", version: "1" })
export class AuditController {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly configHistoryService: ConfigHistoryService,
  ) {}

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Get("audit-logs")
  async getAuditLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AuditLogQueryDto,
  ): Promise<AuditLogPage> {
    return this.auditLogService.getAuditLogs(
      user.workspaceId!,
      query.category,
      query.page ?? DEFAULT_PAGE,
      query.limit ?? DEFAULT_LIMIT,
    );
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Get("config-history")
  async getConfigHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PageQueryDto,
  ): Promise<{ items: ConfigHistoryEntrySummary[]; total: number; page: number; limit: number }> {
    return this.configHistoryService.getHistory(
      user.workspaceId!,
      query.page ?? DEFAULT_PAGE,
      query.limit ?? DEFAULT_LIMIT,
    );
  }
}
