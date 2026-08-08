import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model } from "mongoose";
import { PaymentStatus } from "@wapp/shared-types";
import { Payment, PaymentDocument } from "../schemas/payment.schema.js";

export interface CreatePaymentInput {
  workspaceId: string;
  invoiceId: string;
  gateway: string;
  gatewayReference: string;
  amount: number;
  currency: string;
  recordedBy: string;
  verified?: boolean;
  evidenceUrl?: string | null;
}

/** PRD-007 Volume-2 §4.1/§9 — Platform Payment Operations list filters. */
export interface ListPaymentsForPlatformFilter {
  workspaceId?: string;
  status?: PaymentStatus;
}

export interface ListPaymentsForPlatformResult {
  items: PaymentDocument[];
  total: number;
}

@Injectable()
export class PaymentRepository {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  /** Created PENDING first — §5/§10, "Payment Initiated" precedes its resolved outcome. */
  async create(input: CreatePaymentInput): Promise<PaymentDocument> {
    return this.paymentModel.create({
      ...input,
      verified: input.verified ?? false,
      evidenceUrl: input.evidenceUrl ?? null,
      status: PaymentStatus.PENDING,
      paidAt: null,
      refundedAt: null,
    });
  }

  async findById(id: string): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({ _id: id }).exec();
  }

  async findByIdForWorkspace(id: string, workspaceId: string): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({ _id: id, workspaceId }).exec();
  }

  async list(workspaceId: string): Promise<PaymentDocument[]> {
    return this.paymentModel.find({ workspaceId }).sort({ createdAt: -1 }).exec();
  }

  /** §9 — "One successful Payment closes Invoice": used to reject a second PAID attempt against the same Invoice. */
  async findPaidByInvoice(invoiceId: string): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({ invoiceId, status: PaymentStatus.PAID }).exec();
  }

  async markPaid(id: string, paidAt: Date): Promise<PaymentDocument | null> {
    return this.paymentModel
      .findOneAndUpdate(
        { _id: id },
        { $set: { status: PaymentStatus.PAID, paidAt } },
        { new: true },
      )
      .exec();
  }

  async markFailed(id: string): Promise<PaymentDocument | null> {
    return this.paymentModel
      .findOneAndUpdate({ _id: id }, { $set: { status: PaymentStatus.FAILED } }, { new: true })
      .exec();
  }

  async markRefunded(id: string, refundedAt: Date): Promise<PaymentDocument | null> {
    return this.paymentModel
      .findOneAndUpdate(
        { _id: id },
        { $set: { status: PaymentStatus.REFUNDED, refundedAt } },
        { new: true },
      )
      .exec();
  }

  /** PRD-007 Volume-2 §4.7 (Billing Dashboard, Refund Requests/Failed Payments) — cross-tenant, deliberately no workspaceId filter. */
  async countByStatus(status: PaymentStatus): Promise<number> {
    return this.paymentModel.countDocuments({ status }).exec();
  }

  /** PRD-007 Volume-2 §4.7 (Billing Dashboard, Manual Payments) — a platform operator's own recorded Payments (verified=true is only ever set by the platform manual-recording flow, never tenant self-service). */
  async countVerified(): Promise<number> {
    return this.paymentModel.countDocuments({ verified: true }).exec();
  }

  /** PRD-007 Volume-2 §4.1/§9 — cross-tenant list, deliberately no default workspaceId scope. */
  async listAllForPlatform(
    filter: ListPaymentsForPlatformFilter,
    page: number,
    limit: number,
  ): Promise<ListPaymentsForPlatformResult> {
    const query: FilterQuery<PaymentDocument> = {};
    if (filter.workspaceId) {
      query.workspaceId = filter.workspaceId;
    }
    if (filter.status) {
      query.status = filter.status;
    }

    const [items, total] = await Promise.all([
      this.paymentModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((Math.max(page, 1) - 1) * limit)
        .limit(limit)
        .exec(),
      this.paymentModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }
}
