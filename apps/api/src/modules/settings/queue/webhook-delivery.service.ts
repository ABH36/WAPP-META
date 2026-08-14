import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import type { WebhookEventType } from "@wapp/shared-types";
import { CorrelationContextService } from "../../../common/observability/correlation-context.service.js";
import {
  withCorrelationId,
  type JobContext,
} from "../../../common/observability/job-context.util.js";
import { WEBHOOK_DELIVERY_QUEUE } from "./webhook-delivery.constants.js";

export interface WebhookDeliveryJob extends Partial<JobContext> {
  webhookId: string;
  workspaceId: string;
  event: WebhookEventType;
  payload: object;
}

/**
 * ADR-SET-006 — Domain Event -> Queue -> HTTP Delivery -> Retry -> Dead
 * Letter Handling. `attempts` is the *total* attempt count (first try + N
 * retries), so callers pass `webhook.retryCount + 1`. BullMQ's own
 * exponential backoff handles the "Retry" stage; a job that exhausts all
 * attempts becomes BullMQ's failed-job set — the Dead Letter stage, no
 * separate collection needed (inspectable via BullMQ's own tooling).
 */
@Injectable()
export class WebhookDeliveryService {
  constructor(
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE) private readonly queue: Queue<WebhookDeliveryJob>,
    private readonly correlationContext: CorrelationContextService,
  ) {}

  async enqueue(job: Omit<WebhookDeliveryJob, "correlationId">, attempts: number): Promise<void> {
    const data = withCorrelationId(job, this.correlationContext.getOrCreateCorrelationId());
    await this.queue.add("deliver", data, {
      attempts,
      backoff: { type: "exponential", delay: 5_000 },
    });
  }
}
