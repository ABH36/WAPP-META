import { Test } from "@nestjs/testing";
import { PlatformInvoicesService } from "./platform-invoices.service.js";
import { InvoiceService } from "../../billing/services/invoice.service.js";

describe("PlatformInvoicesService", () => {
  let service: PlatformInvoicesService;
  let invoiceService: jest.Mocked<InvoiceService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformInvoicesService,
        {
          provide: InvoiceService,
          useValue: {
            listAllForPlatform: jest.fn(),
            getById: jest.fn(),
            void: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(PlatformInvoicesService);
    invoiceService = moduleRef.get(InvoiceService);
  });

  it("list() delegates to listAllForPlatform", async () => {
    invoiceService.listAllForPlatform.mockResolvedValue({ items: [], total: 0 });

    await service.list({ workspaceId: "workspace-1" }, 1, 20);

    expect(invoiceService.listAllForPlatform).toHaveBeenCalledWith(
      { workspaceId: "workspace-1" },
      1,
      20,
    );
  });

  it("getById() delegates to InvoiceService.getById", async () => {
    invoiceService.getById.mockResolvedValue({ id: "invoice-1" } as never);

    const result = await service.getById("invoice-1");

    expect(result).toEqual({ id: "invoice-1" });
  });

  it("void() delegates to InvoiceService.void", async () => {
    invoiceService.void.mockResolvedValue({ id: "invoice-1" } as never);

    await service.void("invoice-1", "reason", "op-1");

    expect(invoiceService.void).toHaveBeenCalledWith("invoice-1", "reason", "op-1");
  });
});
