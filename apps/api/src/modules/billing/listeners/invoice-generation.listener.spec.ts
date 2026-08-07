import { Test } from "@nestjs/testing";
import { InvoiceGenerationListener } from "./invoice-generation.listener.js";
import { InvoiceService } from "../services/invoice.service.js";

describe("InvoiceGenerationListener", () => {
  let listener: InvoiceGenerationListener;
  let invoiceService: jest.Mocked<InvoiceService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        InvoiceGenerationListener,
        { provide: InvoiceService, useValue: { generateForSubscriptionUpgrade: jest.fn() } },
      ],
    }).compile();

    listener = moduleRef.get(InvoiceGenerationListener);
    invoiceService = moduleRef.get(InvoiceService);
  });

  it("generates an Invoice for the new plan on every SUBSCRIPTION_UPGRADED", async () => {
    invoiceService.generateForSubscriptionUpgrade.mockResolvedValue({} as never);

    await listener.onSubscriptionUpgraded({
      workspaceId: "workspace-1",
      subscriptionId: "subscription-1",
      previousPlanId: "plan-starter",
      newPlanId: "plan-growth",
      actorId: "user-1",
      occurredAt: new Date().toISOString(),
    });

    expect(invoiceService.generateForSubscriptionUpgrade).toHaveBeenCalledWith(
      "workspace-1",
      "subscription-1",
      "plan-growth",
    );
  });
});
