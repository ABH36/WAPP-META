import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InvoiceStatus, PaymentStatus } from "@wapp/shared-types";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  PaymentFailedPayload,
  PaymentInitiatedPayload,
  PaymentPaidPayload,
  PaymentRefundedPayload,
} from "../../../common/events/domain-events.js";
import { PaymentRepository } from "../repositories/payment.repository.js";
import { InvoiceService } from "./invoice.service.js";
import { toPaymentSummary } from "../mappers/billing.mapper.js";
import type { PaymentSummary } from "../billing.types.js";
import type { PaymentDocument } from "../schemas/payment.schema.js";

const SUPPORTED_CURRENCY = "INR"; // India-only Phase-1 (D002) — same as Plan/Invoice.

export type RecordPaymentOutcome = "PAID" | "FAILED";

/**
 * PRD-005 Volume-2 §8/§9. Manual recording — Payment Gateway Integration is
 * §14 Out of Scope, so there is no async callback: every Payment is created
 * PENDING (PAYMENT_INITIATED) and resolved to its final outcome
 * synchronously in the same call. Recording access is deliberately narrower
 * than BILLING_ACCESS alone would allow — see PaymentController and TD-010.
 * See docs/ADR-BILL-004-invoice-payment-relationship.md.
 */
@Injectable()
export class PaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly invoiceService: InvoiceService,
    private readonly eventEmitter: EventEmitter2,
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
      await this.invoiceService.markPaidFromPayment(invoiceId, workspaceId, created._id.toString());
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
    }

    return toPaymentSummary(resolved);
  }

  async refund(workspaceId: string, paymentId: string, actorId: string): Promise<PaymentSummary> {
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
      occurredAt: now.toISOString(),
    } satisfies PaymentRefundedPayload);

    return toPaymentSummary(updated);
  }

  async getForWorkspace(workspaceId: string, paymentId: string): Promise<PaymentSummary> {
    const payment = await this.findOrThrow(paymentId, workspaceId);
    return toPaymentSummary(payment);
  }

  async list(workspaceId: string): Promise<PaymentSummary[]> {
    const payments = await this.paymentRepository.list(workspaceId);
    return payments.map(toPaymentSummary);
  }

  private async findOrThrow(paymentId: string, workspaceId: string): Promise<PaymentDocument> {
    const payment = await this.paymentRepository.findByIdForWorkspace(paymentId, workspaceId);
    if (!payment) {
      throw new NotFoundException("Payment not found");
    }
    return payment;
  }
}
