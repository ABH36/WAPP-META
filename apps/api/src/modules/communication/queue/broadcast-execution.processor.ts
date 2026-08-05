import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { BroadcastService } from "../services/broadcast.service.js";
import { BROADCAST_EXECUTION_QUEUE } from "./broadcast-execution.constants.js";

interface BroadcastExecutionJobData {
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
@Processor(BROADCAST_EXECUTION_QUEUE)
export class BroadcastExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(BroadcastExecutionProcessor.name);

  constructor(private readonly broadcastService: BroadcastService) {
    super();
  }

  async process(job: Job<BroadcastExecutionJobData>): Promise<void> {
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
