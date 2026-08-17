import { Injectable } from "@nestjs/common";
import {
  ListPaymentsForPlatformResult,
  PaymentService,
  RecordPaymentOutcome,
} from "../../billing/services/payment.service.js";
import type { ListPaymentsForPlatformFilter } from "../../billing/repositories/payment.repository.js";
import type { PaymentSummary } from "../../billing/billing.types.js";

const MAX_PAGE_SIZE = 100;

/** PRD-007 Volume-2 §4.3 — every method delegates to PaymentService (BR-006/§11: no duplicate commercial logic; BR-002: never bypasses validation). */
@Injectable()
export class PlatformPaymentsService {
  constructor(private readonly paymentService: PaymentService) {}

  async list(
    filter: ListPaymentsForPlatformFilter,
    page: number,
    limit: number,
  ): Promise<ListPaymentsForPlatformResult> {
    return this.paymentService.listAllForPlatform(filter, page, Math.min(limit, MAX_PAGE_SIZE));
  }

  async getById(paymentId: string): Promise<PaymentSummary> {
    return this.paymentService.getById(paymentId);
  }

  async recordManual(
    workspaceId: string,
    invoiceId: string,
    gateway: string,
    gatewayReference: string,
    amount: number,
    currency: string,
    outcome: RecordPaymentOutcome,
    actorId: string,
    verified: boolean,
    evidenceUrl: string | null,
  ): Promise<PaymentSummary> {
    return this.paymentService.record(
      workspaceId,
      invoiceId,
      gateway,
      gatewayReference,
      amount,
      currency,
      outcome,
      actorId,
      verified,
      evidenceUrl,
    );
  }

  async refund(paymentId: string, reason: string, actorId: string): Promise<PaymentSummary> {
    return this.paymentService.refundById(paymentId, actorId, reason);
  }
}
