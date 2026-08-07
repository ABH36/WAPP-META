import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
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
}
