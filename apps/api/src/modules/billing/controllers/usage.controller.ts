import { Controller, Get } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { UsageService } from "../services/usage.service.js";
import type {
  EntitlementsSummary,
  PlanLimitsSummary,
  UsageHistoryEntrySummary,
  UsageSummary,
} from "../billing.types.js";

/**
 * §13 — read-only, all four routes ("No mutation endpoints. Usage is
 * system-managed."). BILLING_ACCESS reused as-is (resolved 2026-08-07,
 * Architecture Review) — same gate as every other Billing endpoint.
 */
@Controller({ path: "billing", version: "1" })
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get("usage")
  async getUsage(@CurrentUser() user: AuthenticatedUser): Promise<UsageSummary> {
    return this.usageService.getUsage(user.workspaceId!);
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get("limits")
  async getLimits(@CurrentUser() user: AuthenticatedUser): Promise<PlanLimitsSummary> {
    return this.usageService.getLimits(user.workspaceId!);
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get("entitlements")
  async getEntitlements(@CurrentUser() user: AuthenticatedUser): Promise<EntitlementsSummary> {
    return this.usageService.getEntitlements(user.workspaceId!);
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get("usage/history")
  async getUsageHistory(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UsageHistoryEntrySummary[]> {
    return this.usageService.getUsageHistory(user.workspaceId!);
  }
}
