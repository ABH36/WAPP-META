import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { BillingReportsService } from "../services/billing-reports.service.js";
import { ExportBillingReportDto } from "../dto/export-billing-report.dto.js";
import type {
  BillingDashboardReport,
  BillingInvoiceReport,
  BillingPaymentReport,
  BillingSubscriptionReport,
  RevenueReport,
  UsageSummary,
} from "../billing.types.js";

/**
 * PRD-005 Volume-4 §13. Every route is workspace-scoped (resolved
 * 2026-08-07, Architecture Review — see
 * docs/ADR-BILL-010-billing-reporting-boundary.md) and reuses
 * BILLING_ACCESS, exactly as every prior Billing volume. Read-only
 * throughout — no POST/PATCH/DELETE anywhere, including /export (a GET,
 * per §13's own API list).
 */
@Controller({ path: "billing/reports", version: "1" })
export class BillingReportsController {
  constructor(private readonly billingReportsService: BillingReportsService) {}

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get("dashboard")
  async dashboard(@CurrentUser() user: AuthenticatedUser): Promise<BillingDashboardReport> {
    return this.billingReportsService.getDashboard(user.workspaceId!);
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get("subscriptions")
  async subscriptions(@CurrentUser() user: AuthenticatedUser): Promise<BillingSubscriptionReport> {
    return this.billingReportsService.getSubscriptionReport(user.workspaceId!);
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get("invoices")
  async invoices(@CurrentUser() user: AuthenticatedUser): Promise<BillingInvoiceReport> {
    return this.billingReportsService.getInvoiceReport(user.workspaceId!);
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get("payments")
  async payments(@CurrentUser() user: AuthenticatedUser): Promise<BillingPaymentReport> {
    return this.billingReportsService.getPaymentReport(user.workspaceId!);
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get("revenue")
  async revenue(@CurrentUser() user: AuthenticatedUser): Promise<RevenueReport> {
    return this.billingReportsService.getRevenueReport(user.workspaceId!);
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get("usage")
  async usage(@CurrentUser() user: AuthenticatedUser): Promise<UsageSummary> {
    return this.billingReportsService.getUsageReport(user.workspaceId!);
  }

  // Binary response (CSV/Excel), so this bypasses the global
  // ResponseInterceptor's JSON envelope via @Res() — same precedent as CRM
  // Reports' own export route.
  @RequirePermission(Permission.BILLING_ACCESS)
  @Get("export")
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExportBillingReportDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename, contentType } = await this.billingReportsService.exportReport(
      user.workspaceId!,
      query,
    );
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
