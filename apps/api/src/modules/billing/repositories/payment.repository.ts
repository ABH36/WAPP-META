import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
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
}
