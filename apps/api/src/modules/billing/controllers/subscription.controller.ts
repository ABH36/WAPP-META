import { Body, Controller, Get, Post } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { SubscriptionService } from "../services/subscription.service.js";
import { UpgradeSubscriptionDto } from "../dto/upgrade-subscription.dto.js";
import { DowngradeSubscriptionDto } from "../dto/downgrade-subscription.dto.js";
import type { SubscriptionSummary } from "../billing.types.js";

/**
 * §15 — no /renew endpoint here (resolved 2026-08-07: deferred to Volume-2,
 * since Volume-1 has no way to confirm a payment actually happened —
 * exposing a payment-free "renew" would let a Workspace bypass paying
 * entirely). BILLING_ACCESS is the existing, pre-scaffolded permission
 * (Owner FULL, Administrator VIEW_ONLY, everyone else NONE) — reused
 * as-is, no new permission introduced.
 */
@Controller({ path: "billing/subscription", version: "1" })
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get()
  async get(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionSummary> {
    return this.subscriptionService.getForWorkspace(user.workspaceId!);
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Post("upgrade")
  async upgrade(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpgradeSubscriptionDto,
  ): Promise<SubscriptionSummary> {
    return this.subscriptionService.upgrade(user.workspaceId!, dto.planId, user.userId);
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Post("downgrade")
  async downgrade(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DowngradeSubscriptionDto,
  ): Promise<SubscriptionSummary> {
    return this.subscriptionService.downgrade(user.workspaceId!, dto.planId, user.userId);
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Post("cancel")
  async cancel(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionSummary> {
    return this.subscriptionService.cancel(user.workspaceId!, user.userId);
  }
}
