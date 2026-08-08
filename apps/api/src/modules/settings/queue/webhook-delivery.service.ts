import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import type { WebhookEventType } from "@wapp/shared-types";
import { WEBHOOK_DELIVERY_QUEUE } from "./webhook-delivery.constants.js";

export interface WebhookDeliveryJob {
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
  ) {}

  async enqueue(job: WebhookDeliveryJob, attempts: number): Promise<void> {
    await this.queue.add("deliver", job, {
      attempts,
      backoff: { type: "exponential", delay: 5_000 },
    });
  }
}
