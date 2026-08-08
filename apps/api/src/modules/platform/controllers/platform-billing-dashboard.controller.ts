import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import {
  PlatformBillingDashboardService,
  type PlatformBillingDashboardSnapshot,
} from "../services/platform-billing-dashboard.service.js";
import { BillingHistoryService } from "../../billing/services/billing-history.service.js";
import type { BillingHistoryEntrySummary } from "../../billing/billing.types.js";

const DEFAULT_HISTORY_LIMIT = 20;

class ListBillingHistoryQueryDto {
  @IsString()
  workspaceId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

/**
 * §4.7/§9 — GET /platform/billing/dashboard. Also carries a small
 * workspaceId-filtered Billing History read (`GET /platform/billing/
 * history`), not in §9's literal list, needed to fulfil §4.5's "Recent
 * Activity" per the Architecture Review's resolution to compose the
 * Customer Support view from existing/new list endpoints rather than a
 * dedicated aggregate. See docs/ADR-PLAT-003-platform-billing-operations-boundary.md.
 */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/billing", version: "1" })
export class PlatformBillingDashboardController {
  constructor(
    private readonly platformBillingDashboardService: PlatformBillingDashboardService,
    private readonly billingHistoryService: BillingHistoryService,
  ) {}

  @RequirePlatformPermission(PlatformPermission.VIEW_PLATFORM_BILLING)
  @Get("dashboard")
  async getDashboard(): Promise<PlatformBillingDashboardSnapshot> {
    return this.platformBillingDashboardService.getSnapshot();
  }

  @RequirePlatformPermission(PlatformPermission.VIEW_PLATFORM_BILLING)
  @Get("history")
  async getHistory(
    @Query() query: ListBillingHistoryQueryDto,
  ): Promise<BillingHistoryEntrySummary[]> {
    return this.billingHistoryService.listRecentForWorkspace(
      query.workspaceId,
      query.limit ?? DEFAULT_HISTORY_LIMIT,
    );
  }
}
