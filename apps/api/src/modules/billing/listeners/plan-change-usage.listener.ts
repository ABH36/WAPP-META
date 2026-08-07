import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { SubscriptionUpgradedPayload } from "../../../common/events/domain-events.js";
import { UsageService } from "../services/usage.service.js";

/**
 * PRD-005 Volume-3 §12 (Feature Enabled/Disabled, Workspace
 * Locked/Unlocked). Listens to SUBSCRIPTION_UPGRADED — the same single hook
 * point InvoiceGenerationListener (Volume-2) uses, for the same reason: it
 * fires unconditionally on every plan change. There is no event to hook for
 * a queued downgrade actually being applied at renewalDate
 * (SubscriptionService.applyDuePendingDowngrades, Volume-1, doesn't emit
 * one) — that gap stays open rather than modifying frozen Volume-1 code,
 * see docs/ADR-BILL-008-commercial-enforcement-strategy.md.
 */
@Injectable()
export class PlanChangeUsageListener {
  constructor(private readonly usageService: UsageService) {}

  @OnEvent(DomainEvent.SUBSCRIPTION_UPGRADED)
  async onSubscriptionUpgraded(payload: SubscriptionUpgradedPayload): Promise<void> {
    await this.usageService.handlePlanChange(
      payload.workspaceId,
      payload.previousPlanId,
      payload.newPlanId,
    );
  }
}
