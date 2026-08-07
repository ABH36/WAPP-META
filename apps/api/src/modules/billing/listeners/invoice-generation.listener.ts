import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { SubscriptionUpgradedPayload } from "../../../common/events/domain-events.js";
import { InvoiceService } from "../services/invoice.service.js";

/**
 * PRD-005 Volume-2 §2/§13 — Invoice Generation is internally triggered
 * (resolved 2026-08-07, Architecture Review), never a direct call from
 * Subscription into Invoice. Every successful upgrade() call emits
 * SUBSCRIPTION_UPGRADED unconditionally (whether or not it also activates —
 * see subscription.service.ts), so listening to that single event covers
 * both Trial-to-paid conversion and a plan change while already ACTIVE,
 * with no risk of double-firing from also listening to
 * SUBSCRIPTION_ACTIVATED. See
 * docs/ADR-BILL-005-billing-event-strategy.md.
 */
@Injectable()
export class InvoiceGenerationListener {
  private readonly logger = new Logger(InvoiceGenerationListener.name);

  constructor(private readonly invoiceService: InvoiceService) {}

  @OnEvent(DomainEvent.SUBSCRIPTION_UPGRADED)
  async onSubscriptionUpgraded(payload: SubscriptionUpgradedPayload): Promise<void> {
    await this.invoiceService.generateForSubscriptionUpgrade(
      payload.workspaceId,
      payload.subscriptionId,
      payload.newPlanId,
    );
    this.logger.log(`Invoice generated for workspace ${payload.workspaceId}`);
  }
}
