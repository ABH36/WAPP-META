import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { ObservableProcessor } from "../../../common/observability/observable-processor.base.js";
import { CorrelationContextService } from "../../../common/observability/correlation-context.service.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";
import type { JobContext } from "../../../common/observability/job-context.util.js";
import { ConversationService } from "../services/conversation.service.js";
import {
  CONVERSATION_AUTO_CLOSE_HOURS,
  CONVERSATION_AUTO_CLOSE_QUEUE,
  CONVERSATION_AUTO_CLOSE_SWEEP_INTERVAL_MS,
} from "../communication.constants.js";

const SWEEP_JOB_NAME = "sweep";
const SWEEP_REPEAT_JOB_ID = "conversation-auto-close-sweep";

/**
 * Runs the BDC-012 auto-close sweep on a timer (background job — TAD-001
 * "heavy ops must be queue-based, never block the main request", applied
 * here to a recurring scan rather than a per-request op). Registers its own
 * repeatable job on startup with a fixed `jobId`, which BullMQ treats as
 * idempotent — re-registering the same repeatable job id on every app boot
 * does not create duplicates.
 */
@Injectable()
@Processor(CONVERSATION_AUTO_CLOSE_QUEUE)
export class ConversationAutoCloseProcessor
  extends ObservableProcessor<Partial<JobContext>>
  implements OnModuleInit
{
  protected readonly logger = new Logger(ConversationAutoCloseProcessor.name);
  protected readonly queueName = CONVERSATION_AUTO_CLOSE_QUEUE;

  constructor(
    private readonly conversationService: ConversationService,
    @InjectQueue(CONVERSATION_AUTO_CLOSE_QUEUE) private readonly queue: Queue,
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
        repeat: { every: CONVERSATION_AUTO_CLOSE_SWEEP_INTERVAL_MS },
        jobId: SWEEP_REPEAT_JOB_ID,
      },
    );
  }

  protected async handle(_job: Job<Partial<JobContext>>): Promise<void> {
    const cutoff = new Date(Date.now() - CONVERSATION_AUTO_CLOSE_HOURS * 60 * 60 * 1000);
    const closedCount = await this.conversationService.autoCloseInactive(cutoff);
    if (closedCount > 0) {
      this.logger.log(`Auto-closed ${closedCount} inactive resolved conversation(s)`);
    }
  }
}
