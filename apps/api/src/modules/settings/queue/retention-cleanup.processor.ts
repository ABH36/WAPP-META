import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor } from "@nestjs/bullmq";
import { Queue, type Job } from "bullmq";
import { ObservableProcessor } from "../../../common/observability/observable-processor.base.js";
import { CorrelationContextService } from "../../../common/observability/correlation-context.service.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";
import type { JobContext } from "../../../common/observability/job-context.util.js";
import { AuthService } from "../../identity/services/auth.service.js";
import { RetentionPolicyRepository } from "../repositories/retention-policy.repository.js";
import { AuditLogRepository } from "../repositories/audit-log.repository.js";
import { WebhookDeliveryLogRepository } from "../repositories/webhook-delivery-log.repository.js";
import {
  RETENTION_CLEANUP_QUEUE,
  RETENTION_CLEANUP_SWEEP_INTERVAL_MS,
} from "./retention-cleanup.constants.js";

const SWEEP_JOB_NAME = "sweep";
const SWEEP_REPEAT_JOB_ID = "retention-cleanup-sweep";

/**
 * PRD-006 Volume-4 §4.4 — BR-007: "Retention policies affect future
 * cleanup only." Runs per-workspace, each wrapped in its own try/catch —
 * unlike SubscriptionLifecycleProcessor's bulk-`updateMany` sweep, this
 * one genuinely iterates workspace-by-workspace (each has its own
 * retention configuration), so one workspace's failure must not abort the
 * rest. `notificationHistoryRetentionDays` is read but never acted on —
 * no Notification module exists yet to own that data (TD-020).
 */
@Injectable()
@Processor(RETENTION_CLEANUP_QUEUE, {
  // PHD-001 Volume-3 §9 — sweep must stay serialized, one run at a time.
  concurrency: 1,
})
export class RetentionCleanupProcessor
  extends ObservableProcessor<Partial<JobContext>>
  implements OnModuleInit
{
  protected readonly logger = new Logger(RetentionCleanupProcessor.name);
  protected readonly queueName = RETENTION_CLEANUP_QUEUE;

  constructor(
    private readonly retentionPolicyRepository: RetentionPolicyRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly webhookDeliveryLogRepository: WebhookDeliveryLogRepository,
    private readonly authService: AuthService,
    @InjectQueue(RETENTION_CLEANUP_QUEUE) private readonly queue: Queue,
    correlationContext: CorrelationContextService,
    metricsService: MetricsService,
  ) {
    super(correlationContext, metricsService);
  }

  async onModuleInit(): Promise<void> {
    // Deliberately no `withCorrelationId()` here — this is a repeatable
    // job's data template (reused verbatim by BullMQ on every future tick,
    // per its own `repeat` option), not a per-run payload. Each tick gets
    // its own fresh correlation ID from `ObservableProcessor.process()`'s
    // `job.data.correlationId ?? randomUUID()` fallback instead.
    await this.queue.add(
      SWEEP_JOB_NAME,
      {},
      {
        repeat: { every: RETENTION_CLEANUP_SWEEP_INTERVAL_MS },
        jobId: SWEEP_REPEAT_JOB_ID,
        // PHD-001 Volume-3 §9 — previously no retry at all; a transient
        // failure fetching the workspace list (before the per-workspace
        // try/catch below even begins) meant a fully silent, skipped sweep
        // until the next scheduled tick. Unvalidated starting value pending
        // §27 load-test results.
        attempts: 2,
        backoff: { type: "exponential", delay: 60_000 },
      },
    );
  }

  protected async handle(_job: Job<Partial<JobContext>>): Promise<void> {
    const policies = await this.retentionPolicyRepository.findAll();
    const now = Date.now();
    let totalDeleted = 0;

    for (const policy of policies) {
      try {
        const auditCutoff = new Date(now - policy.auditLogRetentionDays * 24 * 60 * 60 * 1000);
        const loginCutoff = new Date(now - policy.loginHistoryRetentionDays * 24 * 60 * 60 * 1000);
        const webhookCutoff = new Date(
          now - policy.webhookDeliveryLogRetentionDays * 24 * 60 * 60 * 1000,
        );

        const [auditDeleted, loginDeleted, webhookDeleted] = await Promise.all([
          this.auditLogRepository.deleteOlderThan(policy.workspaceId, auditCutoff),
          this.authService.cleanupLoginHistory(policy.workspaceId, loginCutoff),
          this.webhookDeliveryLogRepository.deleteOlderThan(policy.workspaceId, webhookCutoff),
        ]);

        totalDeleted += auditDeleted + loginDeleted + webhookDeleted;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown retention cleanup error";
        this.logger.error(
          `Retention cleanup failed for workspace ${policy.workspaceId}: ${message}`,
        );
      }
    }

    if (totalDeleted > 0) {
      this.logger.log(`Retention cleanup sweep: ${totalDeleted} record(s) removed.`);
    }
  }
}
