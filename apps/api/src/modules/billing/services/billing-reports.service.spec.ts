import { Test } from "@nestjs/testing";
import {
  BillingCycle,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionStatus,
  WorkspaceStatus,
} from "@wapp/shared-types";
import { BillingReportsService } from "./billing-reports.service.js";
import { BillingReportsRepository } from "../repositories/billing-reports.repository.js";
import { SubscriptionRepository } from "../repositories/subscription.repository.js";
import { PlanRepository } from "../repositories/plan.repository.js";
import { InvoiceRepository } from "../repositories/invoice.repository.js";
import { PaymentRepository } from "../repositories/payment.repository.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { UsageService } from "./usage.service.js";
import { ExportBillingReportType, ExportFormat } from "../dto/export-billing-report.dto.js";

const subscription = {
  _id: { toString: () => "subscription-1" },
  workspaceId: "workspace-1",
  status: SubscriptionStatus.ACTIVE,
  planId: { toString: () => "plan-growth" },
  pendingPlanId: null as { toString(): string } | null,
  startDate: new Date("2026-08-01T00:00:00.000Z"),
  renewalDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
  trialEndsAt: null as Date | null,
  graceEndsAt: null as Date | null,
  cancelledAt: null as Date | null,
  billingCycle: BillingCycle.MONTHLY,
  autoRenew: true,
  createdBy: "user-1",
  updatedBy: "user-1",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

const workspace = { status: WorkspaceStatus.ACTIVE };

const plan = { name: "Growth", monthlyPrice: 999, yearlyPrice: 9999 };

const emptyInvoiceCounts = {
  [InvoiceStatus.DRAFT]: 0,
  [InvoiceStatus.ISSUED]: 2,
  [InvoiceStatus.PAID]: 1,
  [InvoiceStatus.VOID]: 0,
  [InvoiceStatus.REFUNDED]: 0,
};

const emptyPaymentCounts = {
  [PaymentStatus.PENDING]: 0,
  [PaymentStatus.PAID]: 1,
  [PaymentStatus.FAILED]: 1,
  [PaymentStatus.REFUNDED]: 0,
  [PaymentStatus.PARTIALLY_REFUNDED]: 0,
  [PaymentStatus.CHARGEBACK]: 0,
};

const usageSummary = { workspaceId: "workspace-1", counters: [] };

describe("BillingReportsService", () => {
  let service: BillingReportsService;
  let billingReportsRepository: jest.Mocked<BillingReportsRepository>;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let planRepository: jest.Mocked<PlanRepository>;
  let invoiceRepository: jest.Mocked<InvoiceRepository>;
  let paymentRepository: jest.Mocked<PaymentRepository>;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let usageService: jest.Mocked<UsageService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingReportsService,
        {
          provide: BillingReportsRepository,
          useValue: {
            countInvoicesByStatus: jest.fn(),
            sumInvoiceAmount: jest.fn(),
            countPaymentsByStatus: jest.fn(),
            sumPaidPaymentsInRange: jest.fn(),
            sumAllPaidPayments: jest.fn(),
            monthlyRevenueBreakdown: jest.fn(),
          },
        },
        { provide: SubscriptionRepository, useValue: { findByWorkspace: jest.fn() } },
        { provide: PlanRepository, useValue: { findById: jest.fn() } },
        { provide: InvoiceRepository, useValue: { list: jest.fn() } },
        { provide: PaymentRepository, useValue: { list: jest.fn() } },
        { provide: WorkspaceRepository, useValue: { findById: jest.fn() } },
        { provide: UsageService, useValue: { getUsage: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(BillingReportsService);
    billingReportsRepository = moduleRef.get(BillingReportsRepository);
    subscriptionRepository = moduleRef.get(SubscriptionRepository);
    planRepository = moduleRef.get(PlanRepository);
    invoiceRepository = moduleRef.get(InvoiceRepository);
    paymentRepository = moduleRef.get(PaymentRepository);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    usageService = moduleRef.get(UsageService);

    subscriptionRepository.findByWorkspace.mockResolvedValue(subscription as never);
    planRepository.findById.mockResolvedValue(plan as never);
    workspaceRepository.findById.mockResolvedValue(workspace as never);
    usageService.getUsage.mockResolvedValue(usageSummary);
    billingReportsRepository.countInvoicesByStatus.mockResolvedValue(emptyInvoiceCounts);
    billingReportsRepository.countPaymentsByStatus.mockResolvedValue(emptyPaymentCounts);
    billingReportsRepository.sumPaidPaymentsInRange.mockResolvedValue(0);
    billingReportsRepository.sumInvoiceAmount.mockResolvedValue(null);
    billingReportsRepository.sumAllPaidPayments.mockResolvedValue(0);
    billingReportsRepository.monthlyRevenueBreakdown.mockResolvedValue([]);
    invoiceRepository.list.mockResolvedValue([]);
    paymentRepository.list.mockResolvedValue([]);
  });

  describe("getDashboard", () => {
    it("derives 0/1 status flags from the single Subscription/Workspace state (workspace-scoped, not cross-tenant)", async () => {
      const result = await service.getDashboard("workspace-1");

      expect(result.activeSubscriptions).toBe(1);
      expect(result.trialWorkspaces).toBe(0);
      expect(result.gracePeriodWorkspaces).toBe(0);
      expect(result.expiredWorkspaces).toBe(0);
      expect(result.pendingInvoices).toBe(2);
      expect(result.paidInvoices).toBe(1);
      expect(result.failedPayments).toBe(1);
      expect(result.refunds).toBe(0);
      expect(result.planDistribution).toEqual([{ planName: "Growth", count: 1 }]);
    });

    it("flags trialWorkspaces=1 and expiredWorkspaces=1 for a Trial-in-Grace-Period Workspace", async () => {
      subscriptionRepository.findByWorkspace.mockResolvedValue({
        ...subscription,
        status: SubscriptionStatus.GRACE_PERIOD,
      } as never);
      workspaceRepository.findById.mockResolvedValue({
        status: WorkspaceStatus.EXPIRED,
      } as never);

      const result = await service.getDashboard("workspace-1");

      expect(result.gracePeriodWorkspaces).toBe(1);
      expect(result.expiredWorkspaces).toBe(1);
      expect(result.activeSubscriptions).toBe(0);
    });
  });

  describe("getSubscriptionReport", () => {
    it("reports isInTrial=false and null trial fields when not in Trial", async () => {
      const result = await service.getSubscriptionReport("workspace-1");

      expect(result.trial.isInTrial).toBe(false);
      expect(result.trial.trialEndsAt).toBeNull();
      expect(result.daysUntilRenewal).toBeGreaterThan(0);
    });

    it("computes trial days remaining when in Trial", async () => {
      const trialEndsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      subscriptionRepository.findByWorkspace.mockResolvedValue({
        ...subscription,
        status: SubscriptionStatus.TRIAL,
        trialEndsAt,
      } as never);

      const result = await service.getSubscriptionReport("workspace-1");

      expect(result.trial.isInTrial).toBe(true);
      expect(result.trial.daysRemaining).toBeGreaterThanOrEqual(4);
    });
  });

  describe("getInvoiceReport", () => {
    it("keeps totalAmount null when no Invoice has a priced amount (TD-011), not a misleading 0", async () => {
      const result = await service.getInvoiceReport("workspace-1");
      expect(result.totalAmount).toBeNull();
    });

    it("returns a real sum once sumInvoiceAmount resolves one", async () => {
      billingReportsRepository.sumInvoiceAmount.mockResolvedValue(1998);
      const result = await service.getInvoiceReport("workspace-1");
      expect(result.totalAmount).toBe(1998);
    });
  });

  describe("getRevenueReport", () => {
    it("computes forecast.expectedAmount from the current Plan's monthlyPrice for a MONTHLY Subscription", async () => {
      const result = await service.getRevenueReport("workspace-1");
      expect(result.forecast.expectedAmount).toBe(999);
    });

    it("uses yearlyPrice for a YEARLY Subscription", async () => {
      subscriptionRepository.findByWorkspace.mockResolvedValue({
        ...subscription,
        billingCycle: BillingCycle.YEARLY,
      } as never);

      const result = await service.getRevenueReport("workspace-1");
      expect(result.forecast.expectedAmount).toBe(9999);
    });

    it("keeps forecast.expectedAmount null when Plan pricing isn't approved yet (TD-009)", async () => {
      planRepository.findById.mockResolvedValue({
        ...plan,
        monthlyPrice: null,
        yearlyPrice: null,
      } as never);

      const result = await service.getRevenueReport("workspace-1");
      expect(result.forecast.expectedAmount).toBeNull();
    });
  });

  describe("exportReport", () => {
    it("produces a non-empty CSV buffer for the dashboard report", async () => {
      const result = await service.exportReport("workspace-1", {
        type: ExportBillingReportType.DASHBOARD,
        format: ExportFormat.CSV,
      });

      expect(result.filename).toBe("dashboard-report.csv");
      expect(result.contentType).toBe("text/csv");
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.buffer.toString("utf-8")).toContain("Active Subscriptions");
    });

    it("produces a non-empty Excel buffer for the revenue report", async () => {
      const result = await service.exportReport("workspace-1", {
        type: ExportBillingReportType.REVENUE,
        format: ExportFormat.EXCEL,
      });

      expect(result.filename).toBe("revenue-report.xlsx");
      expect(result.buffer.length).toBeGreaterThan(0);
    });
  });
});
