import { Injectable, Logger } from "@nestjs/common";
import { Processor } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { ObservableProcessor } from "../../../common/observability/observable-processor.base.js";
import { CorrelationContextService } from "../../../common/observability/correlation-context.service.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";
import type { JobContext } from "../../../common/observability/job-context.util.js";
import { WebhookService } from "../services/webhook.service.js";
import { WEBHOOK_PROCESSING_QUEUE } from "./webhook-processing.constants.js";

export interface WebhookProcessingJobData extends Partial<JobContext> {
  payload: unknown;
}

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
export class WebhookProcessingProcessor extends ObservableProcessor<WebhookProcessingJobData> {
  protected readonly logger = new Logger(WebhookProcessingProcessor.name);
  protected readonly queueName = WEBHOOK_PROCESSING_QUEUE;

  constructor(
    private readonly webhookService: WebhookService,
    correlationContext: CorrelationContextService,
    metricsService: MetricsService,
  ) {
    super(correlationContext, metricsService);
  }

  protected async handle(job: Job<WebhookProcessingJobData>): Promise<void> {
    try {
      await this.webhookService.processEvent(job.data.payload);
    } catch (error) {
      this.logger.error(
        `Webhook processing failed for job ${job.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
