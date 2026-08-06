import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { EscalationService } from "../services/escalation.service.js";
import {
  SLA_ESCALATION_QUEUE,
  SLA_ESCALATION_SWEEP_INTERVAL_MS,
  SLA_RESPONSE_HOURS,
} from "../communication.constants.js";

const SWEEP_JOB_NAME = "sweep";
const SWEEP_REPEAT_JOB_ID = "sla-escalation-sweep";

/**
 * Runs the Part 4c SLA escalation sweep on a timer — same shape as
 * ConversationAutoCloseProcessor (BDC-012's auto-close sweep): a repeatable
 * job registered with a fixed `jobId` on every app boot, which BullMQ
 * treats as idempotent.
 */
@Injectable()
@Processor(SLA_ESCALATION_QUEUE)
export class SlaEscalationProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(SlaEscalationProcessor.name);

  constructor(
    private readonly escalationService: EscalationService,
    @InjectQueue(SLA_ESCALATION_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      SWEEP_JOB_NAME,
      {},
      {
        repeat: { every: SLA_ESCALATION_SWEEP_INTERVAL_MS },
        jobId: SWEEP_REPEAT_JOB_ID,
      },
    );
  }

  async process(_job: Job<unknown>): Promise<void> {
    const cutoff = new Date(Date.now() - SLA_RESPONSE_HOURS * 60 * 60 * 1000);
    const escalatedCount = await this.escalationService.runSweep(cutoff);
    if (escalatedCount > 0) {
      this.logger.log(`Escalated ${escalatedCount} SLA-breached conversation(s)`);
    }
  }
}
