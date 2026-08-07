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
});
