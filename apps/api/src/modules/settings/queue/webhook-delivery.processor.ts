import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { createHmac } from "node:crypto";
import { TokenEncryptionService } from "../../../common/security/token-encryption.service.js";
import { WebhookConfigRepository } from "../repositories/webhook-config.repository.js";
import { WebhookDeliveryLogRepository } from "../repositories/webhook-delivery-log.repository.js";
import { WEBHOOK_DELIVERY_QUEUE } from "./webhook-delivery.constants.js";
import type { WebhookDeliveryJob } from "./webhook-delivery.service.js";

/**
 * Off the request path, per TAD-001 Engineering Standards §Background jobs
 * (same reasoning as Communication's WebhookProcessingProcessor). Signs each
 * delivery with an HMAC-SHA256 of the JSON body using the webhook's own
 * decrypted secret (`X-WAPP-Signature`) so the receiving endpoint can verify
 * authenticity — the stated reason a "secret" field exists on a webhook at
 * all (§4.3).
 */
@Injectable()
@Processor(WEBHOOK_DELIVERY_QUEUE)
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(
    private readonly webhookConfigRepository: WebhookConfigRepository,
    private readonly deliveryLogRepository: WebhookDeliveryLogRepository,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {
    super();
  }

  async process(job: Job<WebhookDeliveryJob>): Promise<void> {
    const { webhookId, workspaceId, event, payload } = job.data;
    const webhook = await this.webhookConfigRepository.findByIdWithSecret(webhookId);
    if (!webhook || !webhook.enabled) {
      // Deleted or disabled since the job was queued — nothing to deliver,
      // not a failure worth retrying.
      return;
    }

    const secret = this.tokenEncryption.decrypt(webhook.secretEncrypted);
    const body = JSON.stringify({ event, workspaceId, payload });
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), webhook.timeoutSeconds * 1000);

    let statusCode: number | null = null;
    let error: string | null = null;

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WAPP-Signature": signature,
          "X-WAPP-Event": event,
        },
        body,
        signal: controller.signal,
      });
      statusCode = response.status;
      if (!response.ok) {
        error = `HTTP ${response.status}`;
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Unknown delivery error";
    } finally {
      clearTimeout(timer);
    }

    const success = error === null;
    await this.deliveryLogRepository.record({
      webhookId,
      workspaceId,
      event,
      success,
      statusCode,
      error,
    });
    await this.webhookConfigRepository.recordDeliveryResult(webhookId, success, error);

    if (!success) {
      this.logger.error(`Webhook delivery failed for ${webhookId}: ${error}`);
      // Rethrow to trigger BullMQ's own retry/backoff up to the job's
      // configured `attempts` (webhook.retryCount + 1).
      throw new Error(error ?? "Webhook delivery failed");
    }
  }
}
