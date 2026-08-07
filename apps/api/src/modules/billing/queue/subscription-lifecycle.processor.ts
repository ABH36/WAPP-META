import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
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
@Processor(SUBSCRIPTION_LIFECYCLE_QUEUE)
export class SubscriptionLifecycleProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionLifecycleProcessor.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    @InjectQueue(SUBSCRIPTION_LIFECYCLE_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      SWEEP_JOB_NAME,
      {},
      {
        repeat: { every: SUBSCRIPTION_LIFECYCLE_SWEEP_INTERVAL_MS },
        jobId: SWEEP_REPEAT_JOB_ID,
      },
    );
  }

  async process(_job: Job<unknown>): Promise<void> {
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
