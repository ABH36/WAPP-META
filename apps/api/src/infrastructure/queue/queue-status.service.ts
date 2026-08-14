import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import type { AppConfig } from "../../config/configuration.js";
import { EMAIL_QUEUE } from "../email/email.constants.js";
import {
  INVOICE_LIFECYCLE_QUEUE,
  SUBSCRIPTION_LIFECYCLE_QUEUE,
} from "../../modules/billing/billing.constants.js";
import {
  CONVERSATION_AUTO_CLOSE_QUEUE,
  SLA_ESCALATION_QUEUE,
} from "../../modules/communication/communication.constants.js";
import { BROADCAST_EXECUTION_QUEUE } from "../../modules/communication/queue/broadcast-execution.constants.js";
import { WEBHOOK_PROCESSING_QUEUE } from "../../modules/communication/queue/webhook-processing.constants.js";
import { SUPPORT_SESSION_LIFECYCLE_QUEUE } from "../../modules/platform/platform.constants.js";
import { DATA_EXPORT_QUEUE } from "../../modules/settings/queue/data-export.constants.js";
import { RETENTION_CLEANUP_QUEUE } from "../../modules/settings/queue/retention-cleanup.constants.js";
import { WEBHOOK_DELIVERY_QUEUE } from "../../modules/settings/queue/webhook-delivery.constants.js";

const QUEUE_NAMES = [
  EMAIL_QUEUE,
  SUBSCRIPTION_LIFECYCLE_QUEUE,
  INVOICE_LIFECYCLE_QUEUE,
  CONVERSATION_AUTO_CLOSE_QUEUE,
  SLA_ESCALATION_QUEUE,
  BROADCAST_EXECUTION_QUEUE,
  WEBHOOK_PROCESSING_QUEUE,
  SUPPORT_SESSION_LIFECYCLE_QUEUE,
  DATA_EXPORT_QUEUE,
  RETENTION_CLEANUP_QUEUE,
  WEBHOOK_DELIVERY_QUEUE,
] as const;

export interface QueueStatusEntry {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  workers: number;
}

/**
 * PHD-001 Volume-2 §4.14 (Diagnostics extension) — a read-only BullMQ status
 * surface for every queue in the system. Deliberately holds its own
 * standalone `Queue` client handles (same shared Redis connection URL as
 * `QueueModule`/every producer) rather than injecting each domain module's
 * DI-registered `Queue` token: those tokens live inside their owning
 * module's own providers (Billing/Communication/Platform/Settings), and
 * reaching into them from here would mean either exporting BullMQ tokens
 * across module boundaries or importing business modules into
 * Infrastructure — both cut against the existing module-ownership
 * boundaries this codebase enforces elsewhere. A read-only monitoring
 * client, scoped to queue *names* (plain string constants, not services) is
 * the narrower, boundary-respecting alternative.
 */
@Injectable()
export class QueueStatusService implements OnModuleDestroy {
  private readonly queues: Queue[];

  constructor(config: ConfigService<AppConfig, true>) {
    const connection = {
      url: config.get("redisUrl", { infer: true }),
      maxRetriesPerRequest: null,
    };
    this.queues = QUEUE_NAMES.map((name) => new Queue(name, { connection }));
  }

  async getStatus(): Promise<QueueStatusEntry[]> {
    return Promise.all(
      this.queues.map(async (queue) => {
        const [counts, workers] = await Promise.all([
          queue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
          queue.getWorkersCount(),
        ]);
        return {
          name: queue.name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
          workers,
        };
      }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.queues.map((queue) => queue.close()));
  }
}
