import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { ObservableProcessor } from "../../../common/observability/observable-processor.base.js";
import { CorrelationContextService } from "../../../common/observability/correlation-context.service.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";
import type { JobContext } from "../../../common/observability/job-context.util.js";
import { SubscriptionService } from "../services/subscription.service.js";
import {
  SUBSCRIPTION_LIFECYCLE_QUEUE,
  SUBSCRIPTION_LIFECYCLE_SWEEP_INTERVAL_MS,
} from "../billing.constants.js";

const SWEEP_JOB_NAME = "sweep";
const SWEEP_REPEAT_JOB_ID = "subscription-lifecycle-sweep";

/**
 * PRD-005 Volume-1 §4/§7/§11 — "Trial automatically expires" /
 * "Grace Period ends automatically" (resolved 2026-08-07: building this
 * sweep is in scope for Volume-1, not deferred). Same shape as
 * ConversationAutoCloseProcessor/SlaEscalationProcessor — a repeatable
 * BullMQ job registered idempotently on every boot. Order matters within
 * one sweep pass: downgrades apply before expiry checks, so a Subscription
 * that both has a due downgrade and is expiring this same tick ends up on
 * its (possibly cheaper) new plan before Grace Period math runs.
 */
@Injectable()
@Processor(SUBSCRIPTION_LIFECYCLE_QUEUE, {
  // PHD-001 Volume-3 §9 — sweep must stay serialized, one run at a time.
  concurrency: 1,
})
export class SubscriptionLifecycleProcessor
  extends ObservableProcessor<Partial<JobContext>>
  implements OnModuleInit
{
  protected readonly logger = new Logger(SubscriptionLifecycleProcessor.name);
  protected readonly queueName = SUBSCRIPTION_LIFECYCLE_QUEUE;

  constructor(
    private readonly subscriptionService: SubscriptionService,
    @InjectQueue(SUBSCRIPTION_LIFECYCLE_QUEUE) private readonly queue: Queue,
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
        repeat: { every: SUBSCRIPTION_LIFECYCLE_SWEEP_INTERVAL_MS },
        jobId: SWEEP_REPEAT_JOB_ID,
        // PHD-001 Volume-3 §9 — previously no retry; each step's updateMany
        // is condition-scoped (matches only currently-due records), so a
        // retry re-running the whole sweep is safe/idempotent. Unvalidated
        // starting value pending §27 load-test results.
        attempts: 2,
        backoff: { type: "exponential", delay: 60_000 },
      },
    );
  }

  protected async handle(_job: Job<Partial<JobContext>>): Promise<void> {
    const now = new Date();

    const downgraded = await this.subscriptionService.applyDuePendingDowngrades(now);
    const movedToGrace =
      await this.subscriptionService.expireLapsedTrialsAndActiveSubscriptions(now);
    const suspended = await this.subscriptionService.suspendExpiredGracePeriods(now);

    if (downgraded > 0 || movedToGrace > 0 || suspended > 0) {
      this.logger.log(
        `Subscription lifecycle sweep: ${downgraded} downgrade(s) applied, ` +
          `${movedToGrace} moved to Grace Period, ${suspended} suspended`,
      );
    }
  }
}
