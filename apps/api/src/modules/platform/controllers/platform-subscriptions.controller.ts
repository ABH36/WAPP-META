import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import { PlatformSubscriptionsService } from "../services/platform-subscriptions.service.js";
import { ListSubscriptionsQueryDto } from "../dto/list-subscriptions-query.dto.js";
import { ExtendTrialDto } from "../dto/extend-trial.dto.js";
import { UpdateSubscriptionPlanDto } from "../dto/update-subscription-plan.dto.js";
import { UpdateSubscriptionStatusDto } from "../dto/update-subscription-status.dto.js";
import type { AuthenticatedPlatformUser } from "../platform.types.js";
import type { SubscriptionSummary } from "../../billing/billing.types.js";
import type { ListSubscriptionsForPlatformResult } from "../../billing/services/subscription.service.js";

/** §4.1/§9 — GET /platform/subscriptions, PATCH /platform/subscriptions/:id/{trial,plan,status}. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/subscriptions", version: "1" })
export class PlatformSubscriptionsController {
  constructor(private readonly platformSubscriptionsService: PlatformSubscriptionsService) {}

  @RequirePlatformPermission(PlatformPermission.VIEW_PLATFORM_BILLING)
  @Get()
  async list(
    @Query() query: ListSubscriptionsQueryDto,
  ): Promise<ListSubscriptionsForPlatformResult> {
    return this.platformSubscriptionsService.list(
      { workspaceId: query.workspaceId, status: query.status },
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @RequirePlatformPermission(PlatformPermission.VIEW_PLATFORM_BILLING)
  @Get(":id")
  async get(@Param("id") id: string): Promise<SubscriptionSummary> {
    return this.platformSubscriptionsService.getById(id);
  }

  @RequirePlatformPermission(PlatformPermission.MANAGE_TRIALS)
  @Patch(":id/trial")
  async extendTrial(
    @Param("id") id: string,
    @Body() dto: ExtendTrialDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<SubscriptionSummary> {
    return this.platformSubscriptionsService.extendTrial(
      id,
      dto.days,
      dto.reason,
      user.platformUserId,
    );
  }

  @RequirePlatformPermission(PlatformPermission.MANAGE_SUBSCRIPTIONS)
  @Patch(":id/plan")
  async changePlan(
    @Param("id") id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<SubscriptionSummary> {
    return this.platformSubscriptionsService.changePlan(
      id,
      dto.planId,
      dto.immediate,
      user.platformUserId,
    );
  }

  @RequirePlatformPermission(PlatformPermission.MANAGE_SUBSCRIPTIONS)
  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateSubscriptionStatusDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<SubscriptionSummary> {
    return this.platformSubscriptionsService.updateStatus(id, dto.status, user.platformUserId);
  }
}
