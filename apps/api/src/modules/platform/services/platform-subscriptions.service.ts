import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SubscriptionStatus } from "@wapp/shared-types";
import { SubscriptionService } from "../../billing/services/subscription.service.js";
import type { ListSubscriptionsForPlatformFilter } from "../../billing/repositories/subscription.repository.js";
import type { ListSubscriptionsForPlatformResult } from "../../billing/services/subscription.service.js";
import type { SubscriptionSummary } from "../../billing/billing.types.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { PlanChangedByOperatorPayload } from "../../../common/events/domain-events.js";

const MAX_PAGE_SIZE = 100;

/**
 * PRD-007 Volume-2 §4.1 — every method here delegates straight into
 * SubscriptionService's own id-based entry points (BR-006/§11: no
 * duplicate commercial logic). `PLAN_CHANGED_BY_OPERATOR` is emitted here,
 * not in Billing — it's a Platform-only audit signal layered on top of the
 * SUBSCRIPTION_UPGRADED/DOWNGRADED event Billing already emits; Billing's
 * SubscriptionService has no concept of "this actor is a platform
 * operator," it only ever receives an actorId string.
 */
@Injectable()
export class PlatformSubscriptionsService {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(
    filter: ListSubscriptionsForPlatformFilter,
    page: number,
    limit: number,
  ): Promise<ListSubscriptionsForPlatformResult> {
    return this.subscriptionService.listAllForPlatform(
      filter,
      page,
      Math.min(limit, MAX_PAGE_SIZE),
    );
  }

  async getById(subscriptionId: string): Promise<SubscriptionSummary> {
    return this.subscriptionService.getByIdForPlatform(subscriptionId);
  }

  async extendTrial(
    subscriptionId: string,
    days: number,
    reason: string,
    actorId: string,
  ): Promise<SubscriptionSummary> {
    return this.subscriptionService.extendTrial(subscriptionId, days, reason, actorId);
  }

  async changePlan(
    subscriptionId: string,
    planId: string,
    immediate: boolean,
    actorId: string,
  ): Promise<SubscriptionSummary> {
    const before = await this.subscriptionService.getByIdForPlatform(subscriptionId);
    const updated = immediate
      ? await this.subscriptionService.upgradeById(subscriptionId, planId, actorId)
      : await this.subscriptionService.downgradeById(subscriptionId, planId, actorId);

    const payload: PlanChangedByOperatorPayload = {
      workspaceId: updated.workspaceId,
      subscriptionId,
      previousPlanId: before.planId,
      newPlanId: planId,
      immediate,
      actorId,
      occurredAt: new Date().toISOString(),
    };
    this.eventEmitter.emit(DomainEvent.PLAN_CHANGED_BY_OPERATOR, payload);

    return updated;
  }

  async updateStatus(
    subscriptionId: string,
    status: SubscriptionStatus,
    actorId: string,
  ): Promise<SubscriptionSummary> {
    return this.subscriptionService.operatorSetStatus(subscriptionId, status, actorId);
  }
}
