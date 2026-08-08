import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InvoiceStatus, PaymentStatus } from "@wapp/shared-types";
import { Invoice, InvoiceDocument } from "../schemas/invoice.schema.js";
import { Payment, PaymentDocument } from "../schemas/payment.schema.js";
import type { MonthlyRevenueEntry } from "../billing.types.js";

/**
 * PRD-005 Volume-4 (Billing Reports & Administration). Read-only
 * throughout — no method here writes anything (§Business Rules "Reports
 * never modify transactional data"). Reads Invoice/Payment's own Mongoose
 * models directly rather than routing through InvoiceRepository/
 * PaymentRepository, since aggregation (grouping/summing) is not what those
 * CRUD-oriented repositories were built for — same reasoning already
 * applied to CRM Reports (docs/ADR-CRM-019-crm-reporting-strategy.md,
 * "Reports is the sole cross-entity read layer," ADR-CRM-021). Every query
 * is workspace-scoped (resolved 2026-08-07, Architecture Review) — see
 * docs/ADR-BILL-010-billing-reporting-boundary.md.
 */
@Injectable()
export class BillingReportsRepository {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  async countInvoicesByStatus(workspaceId: string): Promise<Record<InvoiceStatus, number>> {
    const rows = await this.invoiceModel
      .aggregate<{ _id: InvoiceStatus; count: number }>([
        { $match: { workspaceId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .exec();
    return this.fillStatusCounts(InvoiceStatus, rows);
  }

  /** Null only when zero Invoices have a non-null amount (TD-011) — not the same as a confirmed 0. */
  async sumInvoiceAmount(workspaceId: string): Promise<number | null> {
    const rows = await this.invoiceModel
      .aggregate<{ total: number; pricedCount: number }>([
        { $match: { workspaceId, amount: { $ne: null } } },
        { $group: { _id: null, total: { $sum: "$amount" }, pricedCount: { $sum: 1 } } },
      ])
      .exec();
    const row = rows[0];
    return row && row.pricedCount > 0 ? row.total : null;
  }

  async countPaymentsByStatus(workspaceId: string): Promise<Record<PaymentStatus, number>> {
    const rows = await this.paymentModel
      .aggregate<{ _id: PaymentStatus; count: number }>([
        { $match: { workspaceId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .exec();
    return this.fillStatusCounts(PaymentStatus, rows);
  }

  /** Payment.amount is always a real, required number (manually reported at recording time) — unlike Invoice.amount, this is never blocked by TD-009/TD-011. */
  async sumPaidPaymentsInRange(workspaceId: string, from: Date, to: Date): Promise<number> {
    const rows = await this.paymentModel
      .aggregate<{ total: number }>([
        {
          $match: {
            workspaceId,
            status: PaymentStatus.PAID,
            paidAt: { $gte: from, $lte: to },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ])
      .exec();
    return rows[0]?.total ?? 0;
  }

  async sumAllPaidPayments(workspaceId: string): Promise<number> {
    const rows = await this.paymentModel
      .aggregate<{ total: number }>([
        { $match: { workspaceId, status: PaymentStatus.PAID } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ])
      .exec();
    return rows[0]?.total ?? 0;
  }

  /**
   * PRD-007 Volume-1 §4.2 (Platform Dashboard, Total Revenue) — the one
   * deliberate cross-tenant exception to this repository's own
   * workspace-scoped-throughout rule (docs/ADR-BILL-010-billing-reporting-boundary.md
   * still governs every other method here). Same shape as
   * `sumAllPaidPayments`, just without the `workspaceId` match stage.
   */
  async sumAllPaidPaymentsAcrossWorkspaces(): Promise<number> {
    const rows = await this.paymentModel
      .aggregate<{ total: number }>([
        { $match: { status: PaymentStatus.PAID } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ])
      .exec();
    return rows[0]?.total ?? 0;
  }

  /** Standard calendar-month grouping (resolved the same way CRM Reports' groupForecastByPeriod already does). */
  async monthlyRevenueBreakdown(workspaceId: string, from: Date): Promise<MonthlyRevenueEntry[]> {
    const rows = await this.paymentModel
      .aggregate<{ _id: string; revenue: number }>([
        {
          $match: {
            workspaceId,
            status: PaymentStatus.PAID,
            paidAt: { $gte: from },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$paidAt" } },
            revenue: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();
    return rows.map((row) => ({ month: row._id, revenue: row.revenue }));
  }

  private fillStatusCounts<S extends string>(
    statusEnum: Record<string, S>,
    rows: Array<{ _id: S; count: number }>,
  ): Record<S, number> {
    const result = {} as Record<S, number>;
    for (const status of Object.values(statusEnum)) {
      result[status] = 0;
    }
    for (const row of rows) {
      result[row._id] = row.count;
    }
    return result;
  }
}
