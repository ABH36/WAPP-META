import { Injectable, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import {
  BillingCycle,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionStatus,
  WorkspaceStatus,
} from "@wapp/shared-types";
import { BillingReportsRepository } from "../repositories/billing-reports.repository.js";
import { SubscriptionRepository } from "../repositories/subscription.repository.js";
import { PlanRepository } from "../repositories/plan.repository.js";
import { InvoiceRepository } from "../repositories/invoice.repository.js";
import { PaymentRepository } from "../repositories/payment.repository.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { UsageService } from "./usage.service.js";
import {
  toInvoiceSummary,
  toPaymentSummary,
  toSubscriptionSummary,
} from "../mappers/billing.mapper.js";
import {
  ExportBillingReportType,
  ExportFormat,
  type ExportBillingReportDto,
} from "../dto/export-billing-report.dto.js";
import type {
  BillingDashboardReport,
  BillingInvoiceReport,
  BillingPaymentReport,
  BillingSubscriptionReport,
  RevenueReport,
  UsageSummary,
} from "../billing.types.js";

const REVENUE_BREAKDOWN_MONTHS_BACK = 12;
const MS_PER_DAY = 86_400_000;

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

type ReportRow = Record<string, string | number>;

/**
 * PRD-005 Volume-4 (Billing Reports & Administration). Read-only
 * aggregation layer over Subscription/Invoice/Payment/Usage — never writes
 * (§Business Rules), never caches (always calculates from current state).
 * Workspace-scoped throughout (resolved 2026-08-07, Architecture Review) —
 * see docs/ADR-BILL-010-billing-reporting-boundary.md.
 */
@Injectable()
export class BillingReportsService {
  constructor(
    private readonly billingReportsRepository: BillingReportsRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly usageService: UsageService,
  ) {}

  async getDashboard(workspaceId: string): Promise<BillingDashboardReport> {
    const [subscription, workspace, plan, usage, invoiceCounts, paymentCounts, monthly, annual] =
      await Promise.all([
        this.findSubscriptionOrThrow(workspaceId),
        this.findWorkspaceOrThrow(workspaceId),
        this.currentPlan(workspaceId),
        this.usageService.getUsage(workspaceId),
        this.billingReportsRepository.countInvoicesByStatus(workspaceId),
        this.billingReportsRepository.countPaymentsByStatus(workspaceId),
        this.monthlyRevenue(workspaceId),
        this.annualRevenue(workspaceId),
      ]);

    return {
      activeSubscriptions: subscription.status === SubscriptionStatus.ACTIVE ? 1 : 0,
      trialWorkspaces: subscription.status === SubscriptionStatus.TRIAL ? 1 : 0,
      expiredWorkspaces: workspace.status === WorkspaceStatus.EXPIRED ? 1 : 0,
      gracePeriodWorkspaces: subscription.status === SubscriptionStatus.GRACE_PERIOD ? 1 : 0,
      monthlyRevenue: monthly,
      annualRevenue: annual,
      pendingInvoices: invoiceCounts[InvoiceStatus.ISSUED],
      paidInvoices: invoiceCounts[InvoiceStatus.PAID],
      failedPayments: paymentCounts[PaymentStatus.FAILED],
      refunds: paymentCounts[PaymentStatus.REFUNDED],
      planDistribution: [{ planName: plan.name, count: 1 }],
      usage,
    };
  }

  async getSubscriptionReport(workspaceId: string): Promise<BillingSubscriptionReport> {
    const [subscription, plan] = await Promise.all([
      this.findSubscriptionOrThrow(workspaceId),
      this.currentPlan(workspaceId),
    ]);

    return {
      subscription: toSubscriptionSummary(subscription),
      planName: plan.name,
      daysUntilRenewal: this.daysBetween(new Date(), subscription.renewalDate),
      trial: {
        isInTrial: subscription.status === SubscriptionStatus.TRIAL,
        trialEndsAt: subscription.trialEndsAt ? subscription.trialEndsAt.toISOString() : null,
        daysRemaining: subscription.trialEndsAt
          ? this.daysBetween(new Date(), subscription.trialEndsAt)
          : null,
      },
    };
  }

  async getInvoiceReport(workspaceId: string): Promise<BillingInvoiceReport> {
    const [invoices, countByStatus, totalAmount] = await Promise.all([
      this.invoiceRepository.list(workspaceId),
      this.billingReportsRepository.countInvoicesByStatus(workspaceId),
      this.billingReportsRepository.sumInvoiceAmount(workspaceId),
    ]);

    return {
      totalInvoices: invoices.length,
      totalAmount,
      countByStatus,
      invoices: invoices.map(toInvoiceSummary),
    };
  }

  async getPaymentReport(workspaceId: string): Promise<BillingPaymentReport> {
    const [payments, countByStatus, totalCollected] = await Promise.all([
      this.paymentRepository.list(workspaceId),
      this.billingReportsRepository.countPaymentsByStatus(workspaceId),
      this.billingReportsRepository.sumAllPaidPayments(workspaceId),
    ]);

    return {
      totalPayments: payments.length,
      totalCollected,
      countByStatus,
      payments: payments.map(toPaymentSummary),
    };
  }

  async getRevenueReport(workspaceId: string): Promise<RevenueReport> {
    const breakdownFrom = new Date();
    breakdownFrom.setMonth(breakdownFrom.getMonth() - REVENUE_BREAKDOWN_MONTHS_BACK);

    const [monthly, annual, monthlyBreakdown, subscription, plan] = await Promise.all([
      this.monthlyRevenue(workspaceId),
      this.annualRevenue(workspaceId),
      this.billingReportsRepository.monthlyRevenueBreakdown(workspaceId, breakdownFrom),
      this.findSubscriptionOrThrow(workspaceId),
      this.currentPlan(workspaceId),
    ]);

    const expectedAmount =
      subscription.billingCycle === BillingCycle.YEARLY ? plan.yearlyPrice : plan.monthlyPrice;

    return {
      monthlyRevenue: monthly,
      annualRevenue: annual,
      monthlyBreakdown,
      forecast: {
        nextRenewalDate: subscription.renewalDate.toISOString(),
        expectedAmount,
      },
    };
  }

  async getUsageReport(workspaceId: string): Promise<UsageSummary> {
    return this.usageService.getUsage(workspaceId);
  }

  /** §Export — resolved 2026-08-07: type selects the report, format selects csv|excel, reusing the same computation methods as every other endpoint (no duplicate reporting logic). */
  async exportReport(workspaceId: string, dto: ExportBillingReportDto): Promise<ExportResult> {
    const rows = await this.getReportRows(workspaceId, dto);
    const baseName = `${dto.type}-report`;

    if (dto.format === ExportFormat.EXCEL) {
      const buffer = await this.toExcelBuffer(rows, dto.type);
      return {
        buffer,
        filename: `${baseName}.xlsx`,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }

    return {
      buffer: Buffer.from(this.toCsv(rows), "utf-8"),
      filename: `${baseName}.csv`,
      contentType: "text/csv",
    };
  }

  private async getReportRows(
    workspaceId: string,
    dto: ExportBillingReportDto,
  ): Promise<ReportRow[]> {
    switch (dto.type) {
      case ExportBillingReportType.DASHBOARD:
        return this.dashboardToRows(await this.getDashboard(workspaceId));
      case ExportBillingReportType.SUBSCRIPTION:
        return this.subscriptionReportToRows(await this.getSubscriptionReport(workspaceId));
      case ExportBillingReportType.INVOICES:
        return this.invoiceReportToRows(await this.getInvoiceReport(workspaceId));
      case ExportBillingReportType.PAYMENTS:
        return this.paymentReportToRows(await this.getPaymentReport(workspaceId));
      case ExportBillingReportType.REVENUE:
        return this.revenueReportToRows(await this.getRevenueReport(workspaceId));
      case ExportBillingReportType.USAGE:
        return this.usageReportToRows(await this.getUsageReport(workspaceId));
    }
  }

  private dashboardToRows(d: BillingDashboardReport): ReportRow[] {
    return [
      {
        "Active Subscriptions": d.activeSubscriptions,
        "Trial Workspaces": d.trialWorkspaces,
        "Expired Workspaces": d.expiredWorkspaces,
        "Grace Period Workspaces": d.gracePeriodWorkspaces,
        "Monthly Revenue": d.monthlyRevenue,
        "Annual Revenue": d.annualRevenue,
        "Pending Invoices": d.pendingInvoices,
        "Paid Invoices": d.paidInvoices,
        "Failed Payments": d.failedPayments,
        Refunds: d.refunds,
      },
    ];
  }

  private subscriptionReportToRows(r: BillingSubscriptionReport): ReportRow[] {
    return [
      { Metric: "Plan", Value: r.planName },
      { Metric: "Status", Value: r.subscription.status },
      { Metric: "Days Until Renewal", Value: r.daysUntilRenewal ?? "" },
      { Metric: "In Trial", Value: r.trial.isInTrial ? "Yes" : "No" },
      { Metric: "Trial Days Remaining", Value: r.trial.daysRemaining ?? "" },
    ];
  }

  private invoiceReportToRows(r: BillingInvoiceReport): ReportRow[] {
    return r.invoices.map((invoice) => ({
      "Invoice Number": invoice.invoiceNumber,
      Status: invoice.status,
      Amount: invoice.amount ?? "",
      "Due Date": invoice.dueDate,
      "Paid At": invoice.paidAt ?? "",
    }));
  }

  private paymentReportToRows(r: BillingPaymentReport): ReportRow[] {
    return r.payments.map((payment) => ({
      Gateway: payment.gateway,
      Reference: payment.gatewayReference,
      Status: payment.status,
      Amount: payment.amount,
      "Paid At": payment.paidAt ?? "",
    }));
  }

  private revenueReportToRows(r: RevenueReport): ReportRow[] {
    const rows: ReportRow[] = [
      { Section: "Summary", Metric: "Monthly Revenue", Value: r.monthlyRevenue },
      { Section: "Summary", Metric: "Annual Revenue", Value: r.annualRevenue },
      {
        Section: "Forecast",
        Metric: "Next Renewal",
        Value: r.forecast.nextRenewalDate,
      },
      {
        Section: "Forecast",
        Metric: "Expected Amount",
        Value: r.forecast.expectedAmount ?? "",
      },
    ];
    for (const entry of r.monthlyBreakdown) {
      rows.push({ Section: "Monthly", Metric: entry.month, Value: entry.revenue });
    }
    return rows;
  }

  private usageReportToRows(r: UsageSummary): ReportRow[] {
    return r.counters.map((counter) => ({
      Counter: counter.counterType,
      Count: counter.count,
      Limit: counter.limit ?? "",
      "Percentage Used": counter.percentage !== null ? this.round2(counter.percentage) : "",
      Locked: counter.locked ? "Yes" : "No",
    }));
  }

  private toCsv(rows: ReportRow[]): string {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]!);
    const escape = (value: string | number): string => {
      const str = String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escape(row[header] ?? "")).join(",")),
    ];
    return lines.join("\n");
  }

  private async toExcelBuffer(rows: ReportRow[], sheetName: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]!);
      sheet.addRow(headers);
      for (const row of rows) {
        sheet.addRow(headers.map((header) => row[header] ?? ""));
      }
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as never);
  }

  private async monthlyRevenue(workspaceId: string): Promise<number> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.billingReportsRepository.sumPaidPaymentsInRange(workspaceId, monthStart, now);
  }

  private async annualRevenue(workspaceId: string): Promise<number> {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    return this.billingReportsRepository.sumPaidPaymentsInRange(workspaceId, yearStart, now);
  }

  private async currentPlan(workspaceId: string) {
    const subscription = await this.findSubscriptionOrThrow(workspaceId);
    const plan = await this.planRepository.findById(subscription.planId.toString());
    if (!plan) {
      throw new NotFoundException("Plan not found for this Workspace's Subscription");
    }
    return plan;
  }

  private async findSubscriptionOrThrow(workspaceId: string) {
    const subscription = await this.subscriptionRepository.findByWorkspace(workspaceId);
    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }
    return subscription;
  }

  private async findWorkspaceOrThrow(workspaceId: string) {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }
    return workspace;
  }

  private daysBetween(from: Date, to: Date): number {
    return Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY);
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
