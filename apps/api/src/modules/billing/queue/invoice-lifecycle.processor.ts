import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { InvoiceService } from "../services/invoice.service.js";
import {
  INVOICE_LIFECYCLE_QUEUE,
  INVOICE_LIFECYCLE_SWEEP_INTERVAL_MS,
} from "../billing.constants.js";

const SWEEP_JOB_NAME = "sweep";
const SWEEP_REPEAT_JOB_ID = "invoice-lifecycle-sweep";

/**
 * PRD-005 Volume-2 §10 ("Invoice Overdue" domain event) — nothing in the
 * relayed document specifies a detection mechanism; flagged as a Missing
 * Feature during Architecture Review and resolved by extension of
 * already-authorized scope (same reasoning Volume-1's own
 * SubscriptionLifecycleProcessor was built under: the event exists in the
 * approved catalog, something has to produce it). Same idempotent
 * repeatable-job shape as SubscriptionLifecycleProcessor — a separate
 * processor rather than folding into that one, since it sweeps a different
 * collection (Invoice, not Subscription) for a different condition. See
 * docs/ADR-BILL-005-billing-event-strategy.md.
 */
@Injectable()
@Processor(INVOICE_LIFECYCLE_QUEUE)
export class InvoiceLifecycleProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(InvoiceLifecycleProcessor.name);

  constructor(
    private readonly invoiceService: InvoiceService,
    @InjectQueue(INVOICE_LIFECYCLE_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      SWEEP_JOB_NAME,
      {},
      {
        repeat: { every: INVOICE_LIFECYCLE_SWEEP_INTERVAL_MS },
        jobId: SWEEP_REPEAT_JOB_ID,
      },
    );
  }

  async process(_job: Job<unknown>): Promise<void> {
    const now = new Date();
    const flagged = await this.invoiceService.flagOverdueInvoices(now);
    if (flagged > 0) {
      this.logger.log(`Invoice lifecycle sweep: ${flagged} Invoice(s) flagged overdue`);
    }
  }
}
