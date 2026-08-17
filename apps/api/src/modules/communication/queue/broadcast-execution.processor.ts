import { Injectable, Logger } from "@nestjs/common";
import { Processor } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { ObservableProcessor } from "../../../common/observability/observable-processor.base.js";
import { CorrelationContextService } from "../../../common/observability/correlation-context.service.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";
import type { JobContext } from "../../../common/observability/job-context.util.js";
import { BroadcastService } from "../services/broadcast.service.js";
import { BROADCAST_EXECUTION_QUEUE } from "./broadcast-execution.constants.js";

interface BroadcastExecutionJobData extends Partial<JobContext> {
  workspaceId: string;
  broadcastId: string;
}

/**
 * One job per Broadcast "run" (initial send, or a resume after pause) —
 * enqueued by BroadcastService.create/send/resume, and (for a SCHEDULED
 * broadcast) fired automatically by BullMQ's own delayed-job timer. The
 * job runs the whole fan-out sequentially inside BroadcastService.executeRun
 * — see docs/COMM-BROADCAST-LIFECYCLE.md for the scaling caveat that comes
 * with that choice.
 */
@Injectable()
@Processor(BROADCAST_EXECUTION_QUEUE, {
  // PHD-001 Volume-3 §9 — each job is scoped to one broadcastId (an
  // independent aggregate root, no shared mutable state between broadcasts),
  // so running different broadcasts' runs in parallel is safe. Capped below
  // webhook-processing's throughput to avoid contending with WhatsApp API's
  // own per-workspace rate limits. Unvalidated starting value pending §27
  // load-test results.
  concurrency: 3,
})
export class BroadcastExecutionProcessor extends ObservableProcessor<BroadcastExecutionJobData> {
  protected readonly logger = new Logger(BroadcastExecutionProcessor.name);
  protected readonly queueName = BROADCAST_EXECUTION_QUEUE;

  constructor(
    private readonly broadcastService: BroadcastService,
    correlationContext: CorrelationContextService,
    metricsService: MetricsService,
  ) {
    super(correlationContext, metricsService);
  }

  protected async handle(job: Job<BroadcastExecutionJobData>): Promise<void> {
    try {
      await this.broadcastService.executeRun(job.data.workspaceId, job.data.broadcastId);
    } catch (error) {
      this.logger.error(
        `Broadcast execution failed for job ${job.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
