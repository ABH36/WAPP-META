import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NotFoundException } from "@nestjs/common";
import { BillingCycle, InvoiceStatus } from "@wapp/shared-types";
import { InvoiceService } from "./invoice.service.js";
import { InvoiceRepository } from "../repositories/invoice.repository.js";
import { InvoiceCounterRepository } from "../repositories/invoice-counter.repository.js";
import { PlanRepository } from "../repositories/plan.repository.js";
import { SubscriptionRepository } from "../repositories/subscription.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

const growthPlan = {
  _id: { toString: () => "plan-growth" },
  monthlyPrice: null as number | null,
  yearlyPrice: null as number | null,
  currency: "INR",
};

const subscription = {
  _id: { toString: () => "subscription-1" },
  billingCycle: BillingCycle.MONTHLY,
};

const baseInvoice = {
  _id: { toString: () => "invoice-1" },
  workspaceId: "workspace-1",
  subscriptionId: { toString: () => "subscription-1" },
  invoiceNumber: "INV-orkspace1-000001",
  amount: null as number | null,
  tax: null as number | null,
  currency: "INR",
  dueDate: new Date("2026-08-14T00:00:00.000Z"),
  issuedAt: new Date("2026-08-07T00:00:00.000Z"),
  paidAt: null as Date | null,
  status: InvoiceStatus.ISSUED,
  overdueNotifiedAt: null as Date | null,
  createdAt: new Date("2026-08-07T00:00:00.000Z"),
  updatedAt: new Date("2026-08-07T00:00:00.000Z"),
};

describe("InvoiceService", () => {
  let service: InvoiceService;
  let invoiceRepository: jest.Mocked<InvoiceRepository>;
  let invoiceCounterRepository: jest.Mocked<InvoiceCounterRepository>;
  let planRepository: jest.Mocked<PlanRepository>;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: InvoiceRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByIdForWorkspace: jest.fn(),
            list: jest.fn(),
            markPaid: jest.fn(),
            markRefunded: jest.fn(),
            findOverdueCandidates: jest.fn(),
            markOverdueNotified: jest.fn(),
          },
        },
        { provide: InvoiceCounterRepository, useValue: { next: jest.fn() } },
        { provide: PlanRepository, useValue: { findById: jest.fn() } },
        { provide: SubscriptionRepository, useValue: { findById: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(InvoiceService);
    invoiceRepository = moduleRef.get(InvoiceRepository);
    invoiceCounterRepository = moduleRef.get(InvoiceCounterRepository);
    planRepository = moduleRef.get(PlanRepository);
    subscriptionRepository = moduleRef.get(SubscriptionRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("generateForSubscriptionUpgrade", () => {
    it("generates an ISSUED Invoice with a null amount when Plan pricing isn't approved yet (TD-009/TD-011)", async () => {
      planRepository.findById.mockResolvedValue(growthPlan as never);
      subscriptionRepository.findById.mockResolvedValue(subscription as never);
      invoiceCounterRepository.next.mockResolvedValue(1);
      invoiceRepository.create.mockResolvedValue(baseInvoice as never);

      const result = await service.generateForSubscriptionUpgrade(
        "workspace-1",
        "subscription-1",
        "plan-growth",
      );

      expect(invoiceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "workspace-1",
          subscriptionId: "subscription-1",
          amount: null,
          tax: null,
          currency: "INR",
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.INVOICE_GENERATED,
        expect.objectContaining({ workspaceId: "workspace-1", amount: null }),
      );
      expect(result.status).toBe(InvoiceStatus.ISSUED);
    });

    it("computes amount from Plan.monthlyPrice once pricing is approved, keyed by the Subscription's billingCycle", async () => {
      planRepository.findById.mockResolvedValue({
        ...growthPlan,
        monthlyPrice: 999,
        yearlyPrice: 9999,
      } as never);
      subscriptionRepository.findById.mockResolvedValue(subscription as never);
      invoiceCounterRepository.next.mockResolvedValue(2);
      invoiceRepository.create.mockResolvedValue({ ...baseInvoice, amount: 999 } as never);

      await service.generateForSubscriptionUpgrade("workspace-1", "subscription-1", "plan-growth");

      expect(invoiceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 999 }),
      );
    });

    it("uses yearlyPrice when the Subscription's billingCycle is YEARLY", async () => {
      planRepository.findById.mockResolvedValue({
        ...growthPlan,
        monthlyPrice: 999,
        yearlyPrice: 9999,
      } as never);
      subscriptionRepository.findById.mockResolvedValue({
        ...subscription,
        billingCycle: BillingCycle.YEARLY,
      } as never);
      invoiceCounterRepository.next.mockResolvedValue(3);
      invoiceRepository.create.mockResolvedValue({ ...baseInvoice, amount: 9999 } as never);

      await service.generateForSubscriptionUpgrade("workspace-1", "subscription-1", "plan-growth");

      expect(invoiceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 9999 }),
      );
    });

    it("throws when the Plan or Subscription can't be found", async () => {
      planRepository.findById.mockResolvedValue(null);
      subscriptionRepository.findById.mockResolvedValue(subscription as never);
      invoiceCounterRepository.next.mockResolvedValue(1);

      await expect(
        service.generateForSubscriptionUpgrade("workspace-1", "subscription-1", "plan-growth"),
      ).rejects.toThrow(NotFoundException);
      expect(invoiceRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("markPaidFromPayment", () => {
    it("marks the Invoice PAID and emits INVOICE_PAID", async () => {
      invoiceRepository.markPaid.mockResolvedValue({
        ...baseInvoice,
        status: InvoiceStatus.PAID,
      } as never);

      await service.markPaidFromPayment("invoice-1", "workspace-1", "payment-1");

      expect(invoiceRepository.markPaid).toHaveBeenCalledWith("invoice-1", expect.any(Date));
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.INVOICE_PAID,
        expect.objectContaining({ invoiceId: "invoice-1", paymentId: "payment-1" }),
      );
    });
  });

  describe("flagOverdueInvoices", () => {
    it("marks each candidate notified exactly once and emits INVOICE_OVERDUE per Invoice", async () => {
      invoiceRepository.findOverdueCandidates.mockResolvedValue([baseInvoice as never]);

      const count = await service.flagOverdueInvoices(new Date());

      expect(count).toBe(1);
      expect(invoiceRepository.markOverdueNotified).toHaveBeenCalledWith(
        "invoice-1",
        expect.any(Date),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.INVOICE_OVERDUE,
        expect.objectContaining({ invoiceId: "invoice-1" }),
      );
    });
  });
});
