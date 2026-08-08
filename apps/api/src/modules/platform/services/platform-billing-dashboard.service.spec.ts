import { Test } from "@nestjs/testing";
import { InvoiceStatus, PaymentStatus, SubscriptionStatus } from "@wapp/shared-types";
import { PlatformBillingDashboardService } from "./platform-billing-dashboard.service.js";
import { SubscriptionService } from "../../billing/services/subscription.service.js";
import { InvoiceService } from "../../billing/services/invoice.service.js";
import { PaymentService } from "../../billing/services/payment.service.js";
import { BillingHistoryService } from "../../billing/services/billing-history.service.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

describe("PlatformBillingDashboardService", () => {
  let service: PlatformBillingDashboardService;
  let subscriptionService: jest.Mocked<SubscriptionService>;
  let invoiceService: jest.Mocked<InvoiceService>;
  let paymentService: jest.Mocked<PaymentService>;
  let billingHistoryService: jest.Mocked<BillingHistoryService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformBillingDashboardService,
        { provide: SubscriptionService, useValue: { countByStatusForPlatform: jest.fn() } },
        { provide: InvoiceService, useValue: { countByStatusForPlatform: jest.fn() } },
        {
          provide: PaymentService,
          useValue: { countByStatusForPlatform: jest.fn(), countVerifiedForPlatform: jest.fn() },
        },
        { provide: BillingHistoryService, useValue: { countByEventTypeForPlatform: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformBillingDashboardService);
    subscriptionService = moduleRef.get(SubscriptionService);
    invoiceService = moduleRef.get(InvoiceService);
    paymentService = moduleRef.get(PaymentService);
    billingHistoryService = moduleRef.get(BillingHistoryService);

    subscriptionService.countByStatusForPlatform.mockResolvedValue(10);
    invoiceService.countByStatusForPlatform.mockResolvedValue(3);
    paymentService.countByStatusForPlatform.mockResolvedValue(2);
    paymentService.countVerifiedForPlatform.mockResolvedValue(5);
    billingHistoryService.countByEventTypeForPlatform.mockResolvedValue(4);
  });

  it("aggregates all 6 metrics from the correct Billing service calls", async () => {
    const result = await service.getSnapshot();

    expect(subscriptionService.countByStatusForPlatform).toHaveBeenCalledWith(
      SubscriptionStatus.ACTIVE,
    );
    expect(billingHistoryService.countByEventTypeForPlatform).toHaveBeenCalledWith(
      DomainEvent.TRIAL_EXTENDED,
    );
    expect(paymentService.countByStatusForPlatform).toHaveBeenCalledWith(PaymentStatus.REFUNDED);
    expect(paymentService.countByStatusForPlatform).toHaveBeenCalledWith(PaymentStatus.FAILED);
    expect(invoiceService.countByStatusForPlatform).toHaveBeenCalledWith(InvoiceStatus.ISSUED);

    expect(result).toEqual({
      activeSubscriptions: 10,
      trialExtensions: 4,
      refundRequests: 2,
      failedPayments: 2,
      manualPayments: 5,
      outstandingInvoices: 3,
    });
  });
});
