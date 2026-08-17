import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { ObservableProcessor } from "../../../common/observability/observable-processor.base.js";
import { CorrelationContextService } from "../../../common/observability/correlation-context.service.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";
import type { JobContext } from "../../../common/observability/job-context.util.js";
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
@Processor(INVOICE_LIFECYCLE_QUEUE, {
  // PHD-001 Volume-3 §9 — sweep must stay serialized, one run at a time.
  concurrency: 1,
})
export class InvoiceLifecycleProcessor
  extends ObservableProcessor<Partial<JobContext>>
  implements OnModuleInit
{
  protected readonly logger = new Logger(InvoiceLifecycleProcessor.name);
  protected readonly queueName = INVOICE_LIFECYCLE_QUEUE;

  constructor(
    private readonly invoiceService: InvoiceService,
    @InjectQueue(INVOICE_LIFECYCLE_QUEUE) private readonly queue: Queue,
    correlationContext: CorrelationContextService,
    metricsService: MetricsService,
  ) {
    super(correlationContext, metricsService);
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      SWEEP_JOB_NAME,
      {},
      {
        repeat: { every: INVOICE_LIFECYCLE_SWEEP_INTERVAL_MS },
        jobId: SWEEP_REPEAT_JOB_ID,
        // PHD-001 Volume-3 §9 — previously no retry; the underlying sweep is
        // condition-scoped (matches only currently-overdue Invoices), so a
        // retry re-running it is safe/idempotent. Unvalidated starting
        // value pending §27 load-test results.
        attempts: 2,
        backoff: { type: "exponential", delay: 60_000 },
      },
    );
  }

  protected async handle(_job: Job<Partial<JobContext>>): Promise<void> {
    const now = new Date();
    const flagged = await this.invoiceService.flagOverdueInvoices(now);
    if (flagged > 0) {
      this.logger.log(`Invoice lifecycle sweep: ${flagged} Invoice(s) flagged overdue`);
    }
  }
}
