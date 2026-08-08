import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  GracePeriodStartedPayload,
  InvoiceGeneratedPayload,
  InvoiceOverduePayload,
  InvoicePaidPayload,
  InvoiceVoidedPayload,
  PaymentFailedPayload,
  PaymentInitiatedPayload,
  PaymentPaidPayload,
  PaymentRefundedPayload,
  PaymentVerifiedPayload,
  SubscriptionActivatedPayload,
  SubscriptionCancelledPayload,
  SubscriptionCreatedPayload,
  SubscriptionDowngradedPayload,
  SubscriptionSuspendedPayload,
  SubscriptionUpgradedPayload,
  TrialExpiredPayload,
  TrialExtendedPayload,
  TrialStartedPayload,
} from "../../../common/events/domain-events.js";
import { BillingHistoryService } from "../services/billing-history.service.js";

/**
 * §6 (Billing History — "Business Timeline... Immutable") /§10 (Billing
 * History Recorded). One explicit @OnEvent handler per Billing event
 * (Subscription's Volume-1 catalog + Invoice/Payment's new Volume-2 events)
 * rather than a "**" wildcard — same precedent already established by
 * DomainEventLoggerListener (see its own doc comment: EventEmitter2's
 * wildcard listeners recover the matched event name via `this.event`,
 * which doesn't reliably survive NestJS class-method wrapping). Does NOT
 * listen to BILLING_HISTORY_RECORDED itself (its own output) — that would
 * be an infinite loop. See docs/ADR-BILL-005-billing-event-strategy.md.
 */
@Injectable()
export class BillingHistoryListener {
  constructor(private readonly billingHistoryService: BillingHistoryService) {}

  @OnEvent(DomainEvent.SUBSCRIPTION_CREATED)
  async onSubscriptionCreated(payload: SubscriptionCreatedPayload): Promise<void> {
    await this.record(payload, DomainEvent.SUBSCRIPTION_CREATED, "Subscription created");
  }

  @OnEvent(DomainEvent.TRIAL_STARTED)
  async onTrialStarted(payload: TrialStartedPayload): Promise<void> {
    await this.record(payload, DomainEvent.TRIAL_STARTED, "Trial Started");
  }

  @OnEvent(DomainEvent.TRIAL_EXPIRED)
  async onTrialExpired(payload: TrialExpiredPayload): Promise<void> {
    await this.record(payload, DomainEvent.TRIAL_EXPIRED, "Trial Expired");
  }

  @OnEvent(DomainEvent.SUBSCRIPTION_ACTIVATED)
  async onSubscriptionActivated(payload: SubscriptionActivatedPayload): Promise<void> {
    await this.record(payload, DomainEvent.SUBSCRIPTION_ACTIVATED, "Subscription Activated");
  }

  @OnEvent(DomainEvent.SUBSCRIPTION_UPGRADED)
  async onSubscriptionUpgraded(payload: SubscriptionUpgradedPayload): Promise<void> {
    await this.record(payload, DomainEvent.SUBSCRIPTION_UPGRADED, "Plan Changed (Upgrade)");
  }

  @OnEvent(DomainEvent.SUBSCRIPTION_DOWNGRADED)
  async onSubscriptionDowngraded(payload: SubscriptionDowngradedPayload): Promise<void> {
    await this.record(
      payload,
      DomainEvent.SUBSCRIPTION_DOWNGRADED,
      "Plan Changed (Downgrade Queued)",
    );
  }

  @OnEvent(DomainEvent.SUBSCRIPTION_CANCELLED)
  async onSubscriptionCancelled(payload: SubscriptionCancelledPayload): Promise<void> {
    await this.record(payload, DomainEvent.SUBSCRIPTION_CANCELLED, "Subscription Cancelled");
  }

  @OnEvent(DomainEvent.GRACE_PERIOD_STARTED)
  async onGracePeriodStarted(payload: GracePeriodStartedPayload): Promise<void> {
    await this.record(payload, DomainEvent.GRACE_PERIOD_STARTED, "Grace Period Started");
  }

  @OnEvent(DomainEvent.SUBSCRIPTION_SUSPENDED)
  async onSubscriptionSuspended(payload: SubscriptionSuspendedPayload): Promise<void> {
    await this.record(payload, DomainEvent.SUBSCRIPTION_SUSPENDED, "Subscription Suspended");
  }

  @OnEvent(DomainEvent.INVOICE_GENERATED)
  async onInvoiceGenerated(payload: InvoiceGeneratedPayload): Promise<void> {
    await this.record(
      payload,
      DomainEvent.INVOICE_GENERATED,
      `Invoice Generated (${payload.invoiceNumber})`,
    );
  }

  @OnEvent(DomainEvent.INVOICE_PAID)
  async onInvoicePaid(payload: InvoicePaidPayload): Promise<void> {
    await this.record(payload, DomainEvent.INVOICE_PAID, "Invoice Paid");
  }

  @OnEvent(DomainEvent.INVOICE_OVERDUE)
  async onInvoiceOverdue(payload: InvoiceOverduePayload): Promise<void> {
    await this.record(payload, DomainEvent.INVOICE_OVERDUE, "Invoice Overdue");
  }

  @OnEvent(DomainEvent.PAYMENT_INITIATED)
  async onPaymentInitiated(payload: PaymentInitiatedPayload): Promise<void> {
    await this.record(payload, DomainEvent.PAYMENT_INITIATED, "Payment Initiated");
  }

  @OnEvent(DomainEvent.PAYMENT_PAID)
  async onPaymentPaid(payload: PaymentPaidPayload): Promise<void> {
    await this.record(payload, DomainEvent.PAYMENT_PAID, "Payment Received");
  }

  @OnEvent(DomainEvent.PAYMENT_FAILED)
  async onPaymentFailed(payload: PaymentFailedPayload): Promise<void> {
    await this.record(payload, DomainEvent.PAYMENT_FAILED, "Payment Failed");
  }

  @OnEvent(DomainEvent.PAYMENT_REFUNDED)
  async onPaymentRefunded(payload: PaymentRefundedPayload): Promise<void> {
    await this.record(payload, DomainEvent.PAYMENT_REFUNDED, "Refund Issued");
  }

  // PRD-007 Volume-2 §4/BR-001 — every operator action must generate
  // Billing History. PLAN_CHANGED_BY_OPERATOR deliberately has no handler
  // here (the underlying SUBSCRIPTION_UPGRADED/DOWNGRADED it accompanies is
  // already covered above — a second entry would duplicate it).
  // SUPPORT_TICKET_CREATED/RESOLVED deliberately have no handler either —
  // BR-005, tickets never touch business entities, so they never touch
  // Billing History.

  @OnEvent(DomainEvent.TRIAL_EXTENDED)
  async onTrialExtended(payload: TrialExtendedPayload): Promise<void> {
    await this.record(payload, DomainEvent.TRIAL_EXTENDED, `Trial Extended (${payload.reason})`);
  }

  @OnEvent(DomainEvent.PAYMENT_VERIFIED)
  async onPaymentVerified(payload: PaymentVerifiedPayload): Promise<void> {
    await this.record(payload, DomainEvent.PAYMENT_VERIFIED, "Payment Verified");
  }

  @OnEvent(DomainEvent.INVOICE_VOIDED)
  async onInvoiceVoided(payload: InvoiceVoidedPayload): Promise<void> {
    await this.record(payload, DomainEvent.INVOICE_VOIDED, `Invoice Voided (${payload.reason})`);
  }

  private async record(
    payload: { workspaceId: string; occurredAt: string },
    eventType: string,
    description: string,
  ): Promise<void> {
    await this.billingHistoryService.record(
      payload.workspaceId,
      eventType,
      description,
      payload,
      new Date(payload.occurredAt),
    );
  }
}
