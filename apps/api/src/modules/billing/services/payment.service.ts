import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InvoiceStatus, PaymentStatus } from "@wapp/shared-types";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  PaymentFailedPayload,
  PaymentInitiatedPayload,
  PaymentPaidPayload,
  PaymentRefundedPayload,
  PaymentVerifiedPayload,
} from "../../../common/events/domain-events.js";
import {
  ListPaymentsForPlatformFilter,
  ListPaymentsForPlatformResult as RepositoryListPaymentsResult,
  PaymentRepository,
} from "../repositories/payment.repository.js";
import { InvoiceService } from "./invoice.service.js";
import { toPaymentSummary } from "../mappers/billing.mapper.js";
import type { PaymentSummary } from "../billing.types.js";
import type { PaymentDocument } from "../schemas/payment.schema.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

const SUPPORTED_CURRENCY = "INR"; // India-only Phase-1 (D002) — same as Plan/Invoice.

export type RecordPaymentOutcome = "PAID" | "FAILED";

export interface ListPaymentsForPlatformResult {
  items: PaymentSummary[];
  total: number;
}

/**
 * PRD-005 Volume-2 §8/§9. Manual recording — Payment Gateway Integration is
 * §14 Out of Scope, so there is no async callback: every Payment is created
 * PENDING (PAYMENT_INITIATED) and resolved to its final outcome
 * synchronously in the same call. Recording access is deliberately narrower
 * than BILLING_ACCESS alone would allow — see PaymentController and TD-010.
 * See docs/ADR-BILL-004-invoice-payment-relationship.md.
 *
 * PRD-007 Volume-2 extends this with `verified`/`evidenceUrl` (a platform
 * operator's own manual recording only — TD-010's resolution, see
 * docs/ADR-PLAT-003-platform-billing-operations-boundary.md) and `*ById`/
 * `listAllForPlatform` entry points so Platform Administration can act on a
 * Payment/Subscription/Invoice by id without needing the owning Workspace's
 * id supplied separately.
 */
@Injectable()
export class PaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly invoiceService: InvoiceService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {}

  async record(
    workspaceId: string,
    invoiceId: string,
    gateway: string,
    gatewayReference: string,
    amount: number,
    currency: string,
    outcome: RecordPaymentOutcome,
    recordedBy: string,
    verified = false,
    evidenceUrl: string | null = null,
  ): Promise<PaymentSummary> {
    const invoice = await this.invoiceService.ensureIssuedForPayment(invoiceId, workspaceId);

    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException(`Invalid Invoice Status: Invoice is ${invoice.status}`);
    }
    if (amount <= 0) {
      throw new BadRequestException("Invalid Amount");
    }
    if (currency !== SUPPORTED_CURRENCY) {
      throw new BadRequestException("Invalid Currency");
    }
    const existingPaid = await this.paymentRepository.findPaidByInvoice(invoiceId);
    if (existingPaid) {
      throw new BadRequestException("Duplicate Payment: Invoice is already paid");
    }

    const created = await this.paymentRepository.create({
      workspaceId,
      invoiceId,
      gateway,
      gatewayReference,
      amount,
      currency,
      recordedBy,
      verified,
      evidenceUrl,
    });

    const now = new Date();
    this.eventEmitter.emit(DomainEvent.PAYMENT_INITIATED, {
      workspaceId,
      paymentId: created._id.toString(),
      invoiceId,
      gateway,
      occurredAt: now.toISOString(),
    } satisfies PaymentInitiatedPayload);

    let resolved: PaymentDocument | null;
    if (outcome === "PAID") {
      resolved = await this.paymentRepository.markPaid(created._id.toString(), now);
      if (!resolved) {
        throw new NotFoundException("Payment not found");
      }
      this.eventEmitter.emit(DomainEvent.PAYMENT_PAID, {
        workspaceId,
        paymentId: created._id.toString(),
        invoiceId,
        amount,
        occurredAt: now.toISOString(),
      } satisfies PaymentPaidPayload);
      this.metricsService.billingPaymentsTotal.inc({ outcome: "PAID" });
      await this.invoiceService.markPaidFromPayment(invoiceId, workspaceId, created._id.toString());

      if (verified) {
        this.eventEmitter.emit(DomainEvent.PAYMENT_VERIFIED, {
          workspaceId,
          paymentId: created._id.toString(),
          actorId: recordedBy,
          occurredAt: now.toISOString(),
        } satisfies PaymentVerifiedPayload);
      }
    } else {
      resolved = await this.paymentRepository.markFailed(created._id.toString());
      if (!resolved) {
        throw new NotFoundException("Payment not found");
      }
      this.eventEmitter.emit(DomainEvent.PAYMENT_FAILED, {
        workspaceId,
        paymentId: created._id.toString(),
        invoiceId,
        occurredAt: now.toISOString(),
      } satisfies PaymentFailedPayload);
      this.metricsService.billingPaymentsTotal.inc({ outcome: "FAILED" });
    }

    return toPaymentSummary(resolved);
  }

  async refund(
    workspaceId: string,
    paymentId: string,
    actorId: string,
    reason: string | null = null,
  ): Promise<PaymentSummary> {
    const payment = await this.findOrThrow(paymentId, workspaceId);
    if (payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException(`Invalid Refund: Payment is ${payment.status}, not PAID`);
    }

    const now = new Date();
    const updated = await this.paymentRepository.markRefunded(paymentId, now);
    if (!updated) {
      throw new NotFoundException("Payment not found");
    }
    await this.invoiceService.markRefunded(payment.invoiceId.toString());

    this.eventEmitter.emit(DomainEvent.PAYMENT_REFUNDED, {
      workspaceId,
      paymentId,
      invoiceId: payment.invoiceId.toString(),
      actorId,
      reason,
      occurredAt: now.toISOString(),
    } satisfies PaymentRefundedPayload);
    this.metricsService.billingRefundsTotal.inc();

    return toPaymentSummary(updated);
  }

  /** PRD-007 Volume-2 §4.3/§10 — resolves the owning workspaceId from a bare paymentId, then delegates to refund() (BR-006: no duplicate logic). Reason is required at the Platform controller/DTO layer, not here. */
  async refundById(paymentId: string, actorId: string, reason: string): Promise<PaymentSummary> {
    const payment = await this.findByIdOrThrow(paymentId);
    return this.refund(payment.workspaceId, paymentId, actorId, reason);
  }

  async getForWorkspace(workspaceId: string, paymentId: string): Promise<PaymentSummary> {
    const payment = await this.findOrThrow(paymentId, workspaceId);
    return toPaymentSummary(payment);
  }

  /** PRD-007 Volume-2 §4.1/§9 — cross-tenant read by id, no workspace scoping required. */
  async getById(paymentId: string): Promise<PaymentSummary> {
    const payment = await this.findByIdOrThrow(paymentId);
    return toPaymentSummary(payment);
  }

  async list(workspaceId: string): Promise<PaymentSummary[]> {
    const payments = await this.paymentRepository.list(workspaceId);
    return payments.map(toPaymentSummary);
  }

  /** PRD-007 Volume-2 §4.1/§9 — cross-tenant list (also composes §4.5's Customer Support view when filtered by workspaceId). */
  async listAllForPlatform(
    filter: ListPaymentsForPlatformFilter,
    page: number,
    limit: number,
  ): Promise<ListPaymentsForPlatformResult> {
    const { items, total }: RepositoryListPaymentsResult =
      await this.paymentRepository.listAllForPlatform(filter, page, limit);
    return { items: items.map(toPaymentSummary), total };
  }

  /** PRD-007 Volume-2 §4.7 (Billing Dashboard). */
  async countByStatusForPlatform(status: PaymentStatus): Promise<number> {
    return this.paymentRepository.countByStatus(status);
  }

  /** PRD-007 Volume-2 §4.7 (Billing Dashboard, Manual Payments). */
  async countVerifiedForPlatform(): Promise<number> {
    return this.paymentRepository.countVerified();
  }

  private async findOrThrow(paymentId: string, workspaceId: string): Promise<PaymentDocument> {
    const payment = await this.paymentRepository.findByIdForWorkspace(paymentId, workspaceId);
    if (!payment) {
      throw new NotFoundException("Payment not found");
    }
    return payment;
  }

  private async findByIdOrThrow(paymentId: string): Promise<PaymentDocument> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundException("Payment not found");
    }
    return payment;
  }
}
