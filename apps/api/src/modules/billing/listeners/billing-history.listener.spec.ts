import { Test } from "@nestjs/testing";
import { BillingHistoryListener } from "./billing-history.listener.js";
import { BillingHistoryService } from "../services/billing-history.service.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

describe("BillingHistoryListener", () => {
  let listener: BillingHistoryListener;
  let billingHistoryService: jest.Mocked<BillingHistoryService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingHistoryListener,
        { provide: BillingHistoryService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    listener = moduleRef.get(BillingHistoryListener);
    billingHistoryService = moduleRef.get(BillingHistoryService);
  });

  it("records a Subscription event with the raw event type and full payload as metadata", async () => {
    const occurredAt = new Date().toISOString();
    await listener.onTrialStarted({
      workspaceId: "workspace-1",
      subscriptionId: "subscription-1",
      trialEndsAt: occurredAt,
      occurredAt,
    });

    expect(billingHistoryService.record).toHaveBeenCalledWith(
      "workspace-1",
      DomainEvent.TRIAL_STARTED,
      "Trial Started",
      expect.objectContaining({ subscriptionId: "subscription-1" }),
      new Date(occurredAt),
    );
  });

  it("records an Invoice Generated event with the invoice number in the description", async () => {
    const occurredAt = new Date().toISOString();
    await listener.onInvoiceGenerated({
      workspaceId: "workspace-1",
      invoiceId: "invoice-1",
      subscriptionId: "subscription-1",
      invoiceNumber: "INV-abc-000001",
      amount: null,
      occurredAt,
    });

    expect(billingHistoryService.record).toHaveBeenCalledWith(
      "workspace-1",
      DomainEvent.INVOICE_GENERATED,
      expect.stringContaining("INV-abc-000001"),
      expect.anything(),
      new Date(occurredAt),
    );
  });

  describe("PRD-007 Volume-2 §4/BR-001 handlers", () => {
    it("records TRIAL_EXTENDED with the reason in the description", async () => {
      const occurredAt = new Date().toISOString();
      await listener.onTrialExtended({
        workspaceId: "workspace-1",
        subscriptionId: "subscription-1",
        previousTrialEndsAt: occurredAt,
        newTrialEndsAt: occurredAt,
        reason: "Goodwill extension",
        actorId: "op-1",
        occurredAt,
      });

      expect(billingHistoryService.record).toHaveBeenCalledWith(
        "workspace-1",
        DomainEvent.TRIAL_EXTENDED,
        expect.stringContaining("Goodwill extension"),
        expect.anything(),
        new Date(occurredAt),
      );
    });

    it("records PAYMENT_VERIFIED", async () => {
      const occurredAt = new Date().toISOString();
      await listener.onPaymentVerified({
        workspaceId: "workspace-1",
        paymentId: "payment-1",
        actorId: "op-1",
        occurredAt,
      });

      expect(billingHistoryService.record).toHaveBeenCalledWith(
        "workspace-1",
        DomainEvent.PAYMENT_VERIFIED,
        "Payment Verified",
        expect.anything(),
        new Date(occurredAt),
      );
    });

    it("records INVOICE_VOIDED with the reason in the description", async () => {
      const occurredAt = new Date().toISOString();
      await listener.onInvoiceVoided({
        workspaceId: "workspace-1",
        invoiceId: "invoice-1",
        reason: "Duplicate invoice",
        actorId: "op-1",
        occurredAt,
      });

      expect(billingHistoryService.record).toHaveBeenCalledWith(
        "workspace-1",
        DomainEvent.INVOICE_VOIDED,
        expect.stringContaining("Duplicate invoice"),
        expect.anything(),
        new Date(occurredAt),
      );
    });
  });
});
