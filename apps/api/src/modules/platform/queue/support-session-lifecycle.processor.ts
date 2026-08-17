import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { ObservableProcessor } from "../../../common/observability/observable-processor.base.js";
import { CorrelationContextService } from "../../../common/observability/correlation-context.service.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";
import type { JobContext } from "../../../common/observability/job-context.util.js";
import { PlatformSupportSessionsService } from "../services/platform-support-sessions.service.js";
import {
  SUPPORT_SESSION_LIFECYCLE_QUEUE,
  SUPPORT_SESSION_LIFECYCLE_SWEEP_INTERVAL_MS,
} from "../platform.constants.js";

const SWEEP_JOB_NAME = "sweep";
const SWEEP_REPEAT_JOB_ID = "support-session-lifecycle-sweep";

/** §4.2/BR-003 — "Support Sessions expire automatically." Same repeatable-BullMQ-job shape as Billing's SubscriptionLifecycleProcessor. */
@Injectable()
@Processor(SUPPORT_SESSION_LIFECYCLE_QUEUE, {
  // PHD-001 Volume-3 §9 — sweep must stay serialized, one run at a time.
  concurrency: 1,
})
export class SupportSessionLifecycleProcessor
  extends ObservableProcessor<Partial<JobContext>>
  implements OnModuleInit
{
  protected readonly logger = new Logger(SupportSessionLifecycleProcessor.name);
  protected readonly queueName = SUPPORT_SESSION_LIFECYCLE_QUEUE;

  constructor(
    private readonly platformSupportSessionsService: PlatformSupportSessionsService,
    @InjectQueue(SUPPORT_SESSION_LIFECYCLE_QUEUE) private readonly queue: Queue,
    correlationContext: CorrelationContextService,
    metricsService: MetricsService,
  ) {
    super(correlationContext, metricsService);
  }

  async onModuleInit(): Promise<void> {
    // See RetentionCleanupProcessor's identical comment — a repeatable
    // job's data is a fixed template, not a per-run payload, so no
    // correlationId is baked in here.
    await this.queue.add(
      SWEEP_JOB_NAME,
      {},
      {
        repeat: { every: SUPPORT_SESSION_LIFECYCLE_SWEEP_INTERVAL_MS },
        jobId: SWEEP_REPEAT_JOB_ID,
        // PHD-001 Volume-3 §9 — previously no retry; the underlying sweep is
        // condition-scoped (matches only currently-overdue sessions), so a
        // retry re-running it is safe/idempotent. Unvalidated starting
        // value pending §27 load-test results.
        attempts: 2,
        backoff: { type: "exponential", delay: 60_000 },
      },
    );
  }

  protected async handle(_job: Job<Partial<JobContext>>): Promise<void> {
    const expired = await this.platformSupportSessionsService.expireOverdueSessions(new Date());
    if (expired > 0) {
      this.logger.log(`Support Session lifecycle sweep: ${expired} session(s) expired`);
    }
  }
}
