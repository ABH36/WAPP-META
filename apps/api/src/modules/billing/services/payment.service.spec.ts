import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, PaymentStatus } from "@wapp/shared-types";
import { PaymentService } from "./payment.service.js";
import { PaymentRepository } from "../repositories/payment.repository.js";
import { InvoiceService } from "./invoice.service.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

const issuedInvoice = {
  _id: { toString: () => "invoice-1" },
  workspaceId: "workspace-1",
  status: InvoiceStatus.ISSUED,
};

const basePayment = {
  _id: { toString: () => "payment-1" },
  workspaceId: "workspace-1",
  invoiceId: { toString: () => "invoice-1" },
  gateway: "BANK_TRANSFER",
  gatewayReference: "REF-1",
  amount: 999,
  currency: "INR",
  status: PaymentStatus.PENDING,
  paidAt: null as Date | null,
  refundedAt: null as Date | null,
  recordedBy: "user-1",
  createdAt: new Date("2026-08-07T00:00:00.000Z"),
  updatedAt: new Date("2026-08-07T00:00:00.000Z"),
};

describe("PaymentService", () => {
  let service: PaymentService;
  let paymentRepository: jest.Mocked<PaymentRepository>;
  let invoiceService: jest.Mocked<InvoiceService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PaymentRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByIdForWorkspace: jest.fn(),
            list: jest.fn(),
            findPaidByInvoice: jest.fn(),
            markPaid: jest.fn(),
            markFailed: jest.fn(),
            markRefunded: jest.fn(),
          },
        },
        {
          provide: InvoiceService,
          useValue: {
            ensureIssuedForPayment: jest.fn(),
            markPaidFromPayment: jest.fn(),
            markRefunded: jest.fn(),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PaymentService);
    paymentRepository = moduleRef.get(PaymentRepository);
    invoiceService = moduleRef.get(InvoiceService);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("record", () => {
    it("creates a PENDING Payment, resolves it to PAID, closes the Invoice, and emits INITIATED + PAID", async () => {
      invoiceService.ensureIssuedForPayment.mockResolvedValue(issuedInvoice as never);
      paymentRepository.findPaidByInvoice.mockResolvedValue(null);
      paymentRepository.create.mockResolvedValue(basePayment as never);
      paymentRepository.markPaid.mockResolvedValue({
        ...basePayment,
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      } as never);

      const result = await service.record(
        "workspace-1",
        "invoice-1",
        "BANK_TRANSFER",
        "REF-1",
        999,
        "INR",
        "PAID",
        "user-1",
      );

      expect(paymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceId: "invoice-1", amount: 999 }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.PAYMENT_INITIATED,
        expect.objectContaining({ paymentId: "payment-1" }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.PAYMENT_PAID,
        expect.objectContaining({ paymentId: "payment-1" }),
      );
      expect(invoiceService.markPaidFromPayment).toHaveBeenCalledWith(
        "invoice-1",
        "workspace-1",
        "payment-1",
      );
      expect(result.status).toBe(PaymentStatus.PAID);
    });

    it("resolves to FAILED without closing the Invoice", async () => {
      invoiceService.ensureIssuedForPayment.mockResolvedValue(issuedInvoice as never);
      paymentRepository.findPaidByInvoice.mockResolvedValue(null);
      paymentRepository.create.mockResolvedValue(basePayment as never);
      paymentRepository.markFailed.mockResolvedValue({
        ...basePayment,
        status: PaymentStatus.FAILED,
      } as never);

      const result = await service.record(
        "workspace-1",
        "invoice-1",
        "BANK_TRANSFER",
        "REF-1",
        999,
        "INR",
        "FAILED",
        "user-1",
      );

      expect(invoiceService.markPaidFromPayment).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.PAYMENT_FAILED,
        expect.objectContaining({ paymentId: "payment-1" }),
      );
      expect(result.status).toBe(PaymentStatus.FAILED);
    });

    it("rejects recording against an Invoice that isn't ISSUED (Invalid Invoice Status)", async () => {
      invoiceService.ensureIssuedForPayment.mockResolvedValue({
        ...issuedInvoice,
        status: InvoiceStatus.PAID,
      } as never);

      await expect(
        service.record(
          "workspace-1",
          "invoice-1",
          "BANK_TRANSFER",
          "REF-1",
          999,
          "INR",
          "PAID",
          "user-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });

    it("rejects a non-positive amount (Invalid Amount)", async () => {
      invoiceService.ensureIssuedForPayment.mockResolvedValue(issuedInvoice as never);

      await expect(
        service.record(
          "workspace-1",
          "invoice-1",
          "BANK_TRANSFER",
          "REF-1",
          0,
          "INR",
          "PAID",
          "user-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a non-INR currency (Invalid Currency, D002 India-only Phase-1)", async () => {
      invoiceService.ensureIssuedForPayment.mockResolvedValue(issuedInvoice as never);

      await expect(
        service.record(
          "workspace-1",
          "invoice-1",
          "BANK_TRANSFER",
          "REF-1",
          999,
          "USD",
          "PAID",
          "user-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a second attempt once the Invoice already has a PAID Payment (Duplicate Payment)", async () => {
      invoiceService.ensureIssuedForPayment.mockResolvedValue(issuedInvoice as never);
      paymentRepository.findPaidByInvoice.mockResolvedValue({
        ...basePayment,
        status: PaymentStatus.PAID,
      } as never);

      await expect(
        service.record(
          "workspace-1",
          "invoice-1",
          "BANK_TRANSFER",
          "REF-1",
          999,
          "INR",
          "PAID",
          "user-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("refund", () => {
    it("refunds a PAID Payment, reverts the Invoice, and emits PAYMENT_REFUNDED", async () => {
      paymentRepository.findByIdForWorkspace.mockResolvedValue({
        ...basePayment,
        status: PaymentStatus.PAID,
      } as never);
      paymentRepository.markRefunded.mockResolvedValue({
        ...basePayment,
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
      } as never);

      const result = await service.refund("workspace-1", "payment-1", "user-1");

      expect(invoiceService.markRefunded).toHaveBeenCalledWith("invoice-1");
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.PAYMENT_REFUNDED,
        expect.objectContaining({ paymentId: "payment-1", actorId: "user-1" }),
      );
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it("rejects refunding a Payment that isn't PAID (Invalid Refund)", async () => {
      paymentRepository.findByIdForWorkspace.mockResolvedValue({
        ...basePayment,
        status: PaymentStatus.FAILED,
      } as never);

      await expect(service.refund("workspace-1", "payment-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(paymentRepository.markRefunded).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for a Payment that doesn't exist in this Workspace", async () => {
      paymentRepository.findByIdForWorkspace.mockResolvedValue(null);

      await expect(service.refund("workspace-1", "payment-1", "user-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
