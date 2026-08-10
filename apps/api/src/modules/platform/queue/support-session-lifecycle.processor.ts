import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { PlatformSupportSessionsService } from "../services/platform-support-sessions.service.js";
import {
  SUPPORT_SESSION_LIFECYCLE_QUEUE,
  SUPPORT_SESSION_LIFECYCLE_SWEEP_INTERVAL_MS,
} from "../platform.constants.js";

const SWEEP_JOB_NAME = "sweep";
const SWEEP_REPEAT_JOB_ID = "support-session-lifecycle-sweep";

/** §4.2/BR-003 — "Support Sessions expire automatically." Same repeatable-BullMQ-job shape as Billing's SubscriptionLifecycleProcessor. */
@Injectable()
@Processor(SUPPORT_SESSION_LIFECYCLE_QUEUE)
export class SupportSessionLifecycleProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(SupportSessionLifecycleProcessor.name);

  constructor(
    private readonly platformSupportSessionsService: PlatformSupportSessionsService,
    @InjectQueue(SUPPORT_SESSION_LIFECYCLE_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      SWEEP_JOB_NAME,
      {},
      {
        repeat: { every: SUPPORT_SESSION_LIFECYCLE_SWEEP_INTERVAL_MS },
        jobId: SWEEP_REPEAT_JOB_ID,
      },
    );
  }

  async process(_job: Job<unknown>): Promise<void> {
    const expired = await this.platformSupportSessionsService.expireOverdueSessions(new Date());
    if (expired > 0) {
      this.logger.log(`Support Session lifecycle sweep: ${expired} session(s) expired`);
    }
  }
}
