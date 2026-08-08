import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model } from "mongoose";
import { InvoiceStatus } from "@wapp/shared-types";
import { Invoice, InvoiceDocument } from "../schemas/invoice.schema.js";

export interface CreateInvoiceInput {
  workspaceId: string;
  subscriptionId: string;
  invoiceNumber: string;
  amount: number | null;
  tax: number | null;
  currency: string;
  dueDate: Date;
  issuedAt: Date;
}

/** PRD-007 Volume-2 §4.1/§9 — Platform Invoice Operations list filters. */
export interface ListInvoicesForPlatformFilter {
  workspaceId?: string;
  status?: InvoiceStatus;
}

export interface ListInvoicesForPlatformResult {
  items: InvoiceDocument[];
  total: number;
}

@Injectable()
export class InvoiceRepository {
  constructor(
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
  ) {}

  async create(input: CreateInvoiceInput): Promise<InvoiceDocument> {
    return this.invoiceModel.create({
      ...input,
      status: InvoiceStatus.ISSUED,
      paidAt: null,
      overdueNotifiedAt: null,
    });
  }

  async findById(id: string): Promise<InvoiceDocument | null> {
    return this.invoiceModel.findOne({ _id: id }).exec();
  }

  async findByIdForWorkspace(id: string, workspaceId: string): Promise<InvoiceDocument | null> {
    return this.invoiceModel.findOne({ _id: id, workspaceId }).exec();
  }

  async list(workspaceId: string): Promise<InvoiceDocument[]> {
    return this.invoiceModel.find({ workspaceId }).sort({ createdAt: -1 }).exec();
  }

  async markPaid(id: string, paidAt: Date): Promise<InvoiceDocument | null> {
    return this.invoiceModel
      .findOneAndUpdate(
        { _id: id },
        { $set: { status: InvoiceStatus.PAID, paidAt } },
        { new: true },
      )
      .exec();
  }

  async markRefunded(id: string): Promise<InvoiceDocument | null> {
    return this.invoiceModel
      .findOneAndUpdate({ _id: id }, { $set: { status: InvoiceStatus.REFUNDED } }, { new: true })
      .exec();
  }

  /** PRD-007 Volume-2 §4.2 — the first real consumer of InvoiceStatus.VOID (previously forward-compatibility only, see the enum's own doc comment). */
  async void(id: string): Promise<InvoiceDocument | null> {
    return this.invoiceModel
      .findOneAndUpdate({ _id: id }, { $set: { status: InvoiceStatus.VOID } }, { new: true })
      .exec();
  }

  /** InvoiceLifecycleProcessor's overdue-sweep candidate query — ISSUED, dueDate passed, not yet notified. */
  async findOverdueCandidates(now: Date): Promise<InvoiceDocument[]> {
    return this.invoiceModel
      .find({
        status: InvoiceStatus.ISSUED,
        dueDate: { $lt: now },
        overdueNotifiedAt: null,
      })
      .exec();
  }

  async markOverdueNotified(id: string, notifiedAt: Date): Promise<InvoiceDocument | null> {
    return this.invoiceModel
      .findOneAndUpdate({ _id: id }, { $set: { overdueNotifiedAt: notifiedAt } }, { new: true })
      .exec();
  }

  /** PRD-007 Volume-2 §4.7 (Billing Dashboard, Outstanding Invoices) — cross-tenant, deliberately no workspaceId filter. */
  async countByStatus(status: InvoiceStatus): Promise<number> {
    return this.invoiceModel.countDocuments({ status }).exec();
  }

  /** PRD-007 Volume-2 §4.1/§9 — cross-tenant list, deliberately no default workspaceId scope. */
  async listAllForPlatform(
    filter: ListInvoicesForPlatformFilter,
    page: number,
    limit: number,
  ): Promise<ListInvoicesForPlatformResult> {
    const query: FilterQuery<InvoiceDocument> = {};
    if (filter.workspaceId) {
      query.workspaceId = filter.workspaceId;
    }
    if (filter.status) {
      query.status = filter.status;
    }

    const [items, total] = await Promise.all([
      this.invoiceModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((Math.max(page, 1) - 1) * limit)
        .limit(limit)
        .exec(),
      this.invoiceModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }
}
