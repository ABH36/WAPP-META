import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { WebhookService } from "../services/webhook.service.js";
import { WEBHOOK_PROCESSING_QUEUE } from "./webhook-processing.constants.js";

/**
 * Actual event processing (Contact upsert, Message persistence, status
 * updates) happens here, off the request path — the controller only
 * verifies the signature and enqueues (TAD-001 Engineering Standards
 * §Background jobs: "heavy ops must be queue-based, never block the main
 * request"; a webhook receiver specifically should ack Meta fast so a slow
 * Mongo write doesn't turn into a delivery timeout/retry storm).
 */
@Injectable()
@Processor(WEBHOOK_PROCESSING_QUEUE)
export class WebhookProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessingProcessor.name);

  constructor(private readonly webhookService: WebhookService) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    try {
      await this.webhookService.processEvent(job.data);
    } catch (error) {
      this.logger.error(
        `Webhook processing failed for job ${job.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
