import { Test } from "@nestjs/testing";
import { PlatformPaymentsService } from "./platform-payments.service.js";
import { PaymentService } from "../../billing/services/payment.service.js";

describe("PlatformPaymentsService", () => {
  let service: PlatformPaymentsService;
  let paymentService: jest.Mocked<PaymentService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformPaymentsService,
        {
          provide: PaymentService,
          useValue: {
            listAllForPlatform: jest.fn(),
            getById: jest.fn(),
            record: jest.fn(),
            refundById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(PlatformPaymentsService);
    paymentService = moduleRef.get(PaymentService);
  });

  it("list() delegates to listAllForPlatform", async () => {
    paymentService.listAllForPlatform.mockResolvedValue({ items: [], total: 0 });

    await service.list({ workspaceId: "workspace-1" }, 1, 20);

    expect(paymentService.listAllForPlatform).toHaveBeenCalledWith(
      { workspaceId: "workspace-1" },
      1,
      20,
    );
  });

  it("recordManual() passes verified/evidenceUrl through to PaymentService.record", async () => {
    paymentService.record.mockResolvedValue({ id: "payment-1" } as never);

    await service.recordManual(
      "workspace-1",
      "invoice-1",
      "BANK_TRANSFER",
      "REF-1",
      999,
      "INR",
      "PAID",
      "op-1",
      true,
      "https://evidence.example.com/1",
    );

    expect(paymentService.record).toHaveBeenCalledWith(
      "workspace-1",
      "invoice-1",
      "BANK_TRANSFER",
      "REF-1",
      999,
      "INR",
      "PAID",
      "op-1",
      true,
      "https://evidence.example.com/1",
    );
  });

  it("refund() delegates to PaymentService.refundById", async () => {
    paymentService.refundById.mockResolvedValue({ id: "payment-1" } as never);

    await service.refund("payment-1", "Customer requested", "op-1");

    expect(paymentService.refundById).toHaveBeenCalledWith(
      "payment-1",
      "op-1",
      "Customer requested",
    );
  });
});
