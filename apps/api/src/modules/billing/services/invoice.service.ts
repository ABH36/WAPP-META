import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BillingCycle, InvoiceStatus } from "@wapp/shared-types";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  InvoiceGeneratedPayload,
  InvoiceOverduePayload,
  InvoicePaidPayload,
  InvoiceVoidedPayload,
} from "../../../common/events/domain-events.js";
import {
  InvoiceRepository,
  ListInvoicesForPlatformFilter,
  ListInvoicesForPlatformResult as RepositoryListInvoicesResult,
} from "../repositories/invoice.repository.js";
import { InvoiceCounterRepository } from "../repositories/invoice-counter.repository.js";
import { PlanRepository } from "../repositories/plan.repository.js";
import { SubscriptionRepository } from "../repositories/subscription.repository.js";
import { toInvoiceSummary } from "../mappers/billing.mapper.js";
import type { InvoiceSummary } from "../billing.types.js";
import type { InvoiceDocument } from "../schemas/invoice.schema.js";

export interface ListInvoicesForPlatformResult {
  items: InvoiceSummary[];
  total: number;
}

/**
 * Invoice due window: 7 days from issue. Not a PRD-005 §7 field — an
 * operational timing constant, not a commercial value (unlike
 * amount/tax, which stay null pending approval — TD-011). Reuses the same
 * 7-day convention already established twice in this codebase
 * (SUBSCRIPTION_GRACE_PERIOD_DAYS, PAYMENT_GRACE_PERIOD_DAYS) rather than
 * inventing an unrelated figure.
 */
const INVOICE_DUE_WINDOW_DAYS = 7;

/**
 * PRD-005 Volume-2 (Invoices & Payments). §13 — Invoice never modifies
 * Subscription/Workspace/CRM; generation is triggered the other way,
 * InvoiceGenerationListener reacting to SUBSCRIPTION_UPGRADED (every
 * successful Upgrade call means the Workspace now owes for the new plan —
 * resolved 2026-08-07, Architecture Review: internally triggered, no
 * inbound call from Invoice into Subscription). See
 * docs/ADR-BILL-004-invoice-payment-relationship.md and
 * docs/ADR-BILL-005-billing-event-strategy.md.
 */
@Injectable()
export class InvoiceService {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly invoiceCounterRepository: InvoiceCounterRepository,
    private readonly planRepository: PlanRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Called by InvoiceGenerationListener. amount/tax stay null when Plan
   * pricing isn't approved yet (TD-009/TD-011) — computed from Plan when
   * available so approval later needs no code change here.
   */
  async generateForSubscriptionUpgrade(
    workspaceId: string,
    subscriptionId: string,
    planId: string,
  ): Promise<InvoiceSummary> {
    const [plan, subscription, seq] = await Promise.all([
      this.planRepository.findById(planId),
      this.subscriptionRepository.findById(subscriptionId),
      this.invoiceCounterRepository.next(workspaceId),
    ]);
    if (!plan || !subscription) {
      throw new NotFoundException("Plan or Subscription not found for Invoice generation");
    }

    const amount =
      subscription.billingCycle === BillingCycle.YEARLY ? plan.yearlyPrice : plan.monthlyPrice;

    const now = new Date();
    const dueDate = new Date(now.getTime() + INVOICE_DUE_WINDOW_DAYS * 86_400_000);
    const invoiceNumber = `INV-${workspaceId.slice(-8)}-${String(seq).padStart(6, "0")}`;

    const created = await this.invoiceRepository.create({
      workspaceId,
      subscriptionId,
      invoiceNumber,
      amount,
      // No tax-rate configuration exists yet — same not-yet-approved-value
      // discipline as amount (TD-011).
      tax: null,
      currency: plan.currency,
      dueDate,
      issuedAt: now,
    });

    this.eventEmitter.emit(DomainEvent.INVOICE_GENERATED, {
      workspaceId,
      invoiceId: created._id.toString(),
      subscriptionId,
      invoiceNumber,
      amount,
      occurredAt: now.toISOString(),
    } satisfies InvoiceGeneratedPayload);

    return toInvoiceSummary(created);
  }

  async getForWorkspace(workspaceId: string, invoiceId: string): Promise<InvoiceSummary> {
    const invoice = await this.findOrThrow(invoiceId, workspaceId);
    return toInvoiceSummary(invoice);
  }

  async list(workspaceId: string): Promise<InvoiceSummary[]> {
    const invoices = await this.invoiceRepository.list(workspaceId);
    return invoices.map(toInvoiceSummary);
  }

  /** Called by PaymentService once a Payment resolves to PAID — §9, "One successful Payment closes Invoice." */
  async markPaidFromPayment(
    invoiceId: string,
    workspaceId: string,
    paymentId: string,
  ): Promise<void> {
    const paidAt = new Date();
    const updated = await this.invoiceRepository.markPaid(invoiceId, paidAt);
    if (!updated) {
      throw new NotFoundException("Invoice not found");
    }

    this.eventEmitter.emit(DomainEvent.INVOICE_PAID, {
      workspaceId,
      invoiceId,
      paymentId,
      occurredAt: paidAt.toISOString(),
    } satisfies InvoicePaidPayload);
  }

  /** Called by PaymentService.refund() — the Invoice a refunded Payment closed reverts to REFUNDED too. */
  async markRefunded(invoiceId: string): Promise<void> {
    const updated = await this.invoiceRepository.markRefunded(invoiceId);
    if (!updated) {
      throw new NotFoundException("Invoice not found");
    }
  }

  /** InvoiceLifecycleProcessor's hourly sweep — fires INVOICE_OVERDUE exactly once per Invoice. */
  async flagOverdueInvoices(now: Date): Promise<number> {
    const candidates = await this.invoiceRepository.findOverdueCandidates(now);

    for (const invoice of candidates) {
      await this.invoiceRepository.markOverdueNotified(invoice._id.toString(), now);
      this.eventEmitter.emit(DomainEvent.INVOICE_OVERDUE, {
        workspaceId: invoice.workspaceId,
        invoiceId: invoice._id.toString(),
        dueDate: invoice.dueDate.toISOString(),
        occurredAt: now.toISOString(),
      } satisfies InvoiceOverduePayload);
    }

    return candidates.length;
  }

  async ensureIssuedForPayment(invoiceId: string, workspaceId: string): Promise<InvoiceDocument> {
    return this.findOrThrow(invoiceId, workspaceId);
  }

  /** PRD-007 Volume-2 §4.2/§9 — the first real consumer of InvoiceStatus.VOID; only an ISSUED Invoice can be voided (a PAID/REFUNDED one has real money attached, VOID is for a mistaken/duplicate/no-longer-owed ISSUED Invoice). */
  async void(invoiceId: string, reason: string, actorId: string): Promise<InvoiceSummary> {
    const invoice = await this.findByIdOrThrow(invoiceId);
    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException(`Cannot void an Invoice that is ${invoice.status}`);
    }

    const updated = await this.invoiceRepository.void(invoiceId);
    if (!updated) {
      throw new NotFoundException("Invoice not found");
    }

    this.eventEmitter.emit(DomainEvent.INVOICE_VOIDED, {
      workspaceId: invoice.workspaceId,
      invoiceId,
      reason,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies InvoiceVoidedPayload);

    return toInvoiceSummary(updated);
  }

  /** PRD-007 Volume-2 §4.1/§9 — cross-tenant read by id, no workspace scoping required. */
  async getById(invoiceId: string): Promise<InvoiceSummary> {
    const invoice = await this.findByIdOrThrow(invoiceId);
    return toInvoiceSummary(invoice);
  }

  /** PRD-007 Volume-2 §4.1/§9 — cross-tenant list (also composes §4.5's Customer Support view when filtered by workspaceId). */
  async listAllForPlatform(
    filter: ListInvoicesForPlatformFilter,
    page: number,
    limit: number,
  ): Promise<ListInvoicesForPlatformResult> {
    const { items, total }: RepositoryListInvoicesResult =
      await this.invoiceRepository.listAllForPlatform(filter, page, limit);
    return { items: items.map(toInvoiceSummary), total };
  }

  /** PRD-007 Volume-2 §4.7 (Billing Dashboard, Outstanding Invoices). */
  async countByStatusForPlatform(status: InvoiceStatus): Promise<number> {
    return this.invoiceRepository.countByStatus(status);
  }

  private async findOrThrow(invoiceId: string, workspaceId: string): Promise<InvoiceDocument> {
    const invoice = await this.invoiceRepository.findByIdForWorkspace(invoiceId, workspaceId);
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    return invoice;
  }

  private async findByIdOrThrow(invoiceId: string): Promise<InvoiceDocument> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    return invoice;
  }
}
