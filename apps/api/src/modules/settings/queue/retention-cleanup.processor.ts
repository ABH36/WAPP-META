import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Queue, type Job } from "bullmq";
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
@Processor(RETENTION_CLEANUP_QUEUE)
export class RetentionCleanupProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(RetentionCleanupProcessor.name);

  constructor(
    private readonly retentionPolicyRepository: RetentionPolicyRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly webhookDeliveryLogRepository: WebhookDeliveryLogRepository,
    private readonly authService: AuthService,
    @InjectQueue(RETENTION_CLEANUP_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      SWEEP_JOB_NAME,
      {},
      {
        repeat: { every: RETENTION_CLEANUP_SWEEP_INTERVAL_MS },
        jobId: SWEEP_REPEAT_JOB_ID,
      },
    );
  }

  async process(_job: Job<unknown>): Promise<void> {
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
