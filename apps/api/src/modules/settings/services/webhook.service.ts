import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TokenEncryptionService } from "../../../common/security/token-encryption.service.js";
import { WebhookConfigRepository } from "../repositories/webhook-config.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  WebhookCreatedPayload,
  WebhookUpdatedPayload,
} from "../../../common/events/domain-events.js";
import type { CreateWebhookDto } from "../dto/create-webhook.dto.js";
import type { UpdateWebhookDto } from "../dto/update-webhook.dto.js";
import type { WebhookSummary } from "../settings.types.js";
import type { WebhookConfigDocument } from "../schemas/webhook-config.schema.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

function toWebhookSummary(webhook: WebhookConfigDocument): WebhookSummary {
  return {
    id: webhook._id.toString(),
    url: webhook.url,
    enabled: webhook.enabled,
    retryCount: webhook.retryCount,
    timeoutSeconds: webhook.timeoutSeconds,
    events: webhook.events,
    status: webhook.status,
    lastDeliveryAt: webhook.lastDeliveryAt ? webhook.lastDeliveryAt.toISOString() : null,
    lastError: webhook.lastError,
    createdAt: webhook.createdAt.toISOString(),
  };
}

/**
 * PRD-006 Volume-3 §4.3 — config CRUD. The secret is generated here, shown
 * exactly once in the create response (same one-time-display posture BR-007
 * gives API Keys, applied consistently to this other bearer-secret type),
 * and never returned again afterward (BR-002).
 */
@Injectable()
export class WebhookService {
  constructor(
    private readonly webhookConfigRepository: WebhookConfigRepository,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {}

  async list(workspaceId: string): Promise<WebhookSummary[]> {
    const webhooks = await this.webhookConfigRepository.findByWorkspace(workspaceId);
    return webhooks.map(toWebhookSummary);
  }

  async create(
    workspaceId: string,
    actorId: string,
    dto: CreateWebhookDto,
  ): Promise<{ webhook: WebhookSummary; secret: string }> {
    const secret = randomBytes(32).toString("hex");
    const created = await this.webhookConfigRepository.create({
      workspaceId,
      url: dto.url,
      secretEncrypted: this.tokenEncryption.encrypt(secret),
      enabled: dto.enabled ?? true,
      retryCount: dto.retryCount ?? 3,
      timeoutSeconds: dto.timeoutSeconds ?? 30,
      events: dto.events,
    });

    this.eventEmitter.emit(DomainEvent.WEBHOOK_CREATED, {
      workspaceId,
      webhookId: created._id.toString(),
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies WebhookCreatedPayload);
    this.metricsService.settingsWebhooksTotal.inc({ action: "created" });

    return { webhook: toWebhookSummary(created), secret };
  }

  async update(
    workspaceId: string,
    actorId: string,
    id: string,
    dto: UpdateWebhookDto,
  ): Promise<WebhookSummary> {
    const updated = await this.webhookConfigRepository.update(workspaceId, id, dto);
    if (!updated) {
      throw new NotFoundException("Webhook not found");
    }

    this.eventEmitter.emit(DomainEvent.WEBHOOK_UPDATED, {
      workspaceId,
      webhookId: id,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies WebhookUpdatedPayload);
    this.metricsService.settingsWebhooksTotal.inc({ action: "updated" });

    return toWebhookSummary(updated);
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    const deleted = await this.webhookConfigRepository.delete(workspaceId, id);
    if (!deleted) {
      throw new NotFoundException("Webhook not found");
    }
    this.metricsService.settingsWebhooksTotal.inc({ action: "deleted" });
  }
}
