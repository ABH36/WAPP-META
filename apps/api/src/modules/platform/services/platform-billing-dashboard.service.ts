import { Injectable } from "@nestjs/common";
import { InvoiceStatus, PaymentStatus, SubscriptionStatus } from "@wapp/shared-types";
import { SubscriptionService } from "../../billing/services/subscription.service.js";
import { InvoiceService } from "../../billing/services/invoice.service.js";
import { PaymentService } from "../../billing/services/payment.service.js";
import { BillingHistoryService } from "../../billing/services/billing-history.service.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

export interface PlatformBillingDashboardSnapshot {
  activeSubscriptions: number;
  trialExtensions: number;
  refundRequests: number;
  failedPayments: number;
  manualPayments: number;
  outstandingInvoices: number;
}

/**
 * PRD-007 Volume-2 §4.7 — live aggregation at read time, nothing persisted
 * (matches Volume-1's Platform Dashboard precedent). Every count delegates
 * to a Billing service's own cross-tenant count method (BR-006/§11).
 * "Manual Payments" reads Payment.verified=true — the field only the
 * platform manual-recording flow (§4.3) ever sets — as the signal for "an
 * operator recorded this," since every Payment in this codebase is
 * manually recorded (no gateway integration exists at all, TD-012) and so
 * "manual" alone can't distinguish anything on its own.
 */
@Injectable()
export class PlatformBillingDashboardService {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly invoiceService: InvoiceService,
    private readonly paymentService: PaymentService,
    private readonly billingHistoryService: BillingHistoryService,
  ) {}

  async getSnapshot(): Promise<PlatformBillingDashboardSnapshot> {
    const [
      activeSubscriptions,
      trialExtensions,
      refundRequests,
      failedPayments,
      manualPayments,
      outstandingInvoices,
    ] = await Promise.all([
      this.subscriptionService.countByStatusForPlatform(SubscriptionStatus.ACTIVE),
      this.billingHistoryService.countByEventTypeForPlatform(DomainEvent.TRIAL_EXTENDED),
      this.paymentService.countByStatusForPlatform(PaymentStatus.REFUNDED),
      this.paymentService.countByStatusForPlatform(PaymentStatus.FAILED),
      this.paymentService.countVerifiedForPlatform(),
      this.invoiceService.countByStatusForPlatform(InvoiceStatus.ISSUED),
    ]);

    return {
      activeSubscriptions,
      trialExtensions,
      refundRequests,
      failedPayments,
      manualPayments,
      outstandingInvoices,
    };
  }
}
