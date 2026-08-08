import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  FeatureFlagUpdatedPayload,
  SettingsUpdatedPayload,
  WebhookCreatedPayload,
  WebhookUpdatedPayload,
  WorkspaceUpdatedPayload,
} from "../../../common/events/domain-events.js";
import { ConfigHistoryRepository } from "../repositories/config-history.repository.js";
import { WorkspaceSettingsRepository } from "../repositories/workspace-settings.repository.js";
import { WebhookConfigRepository } from "../repositories/webhook-config.repository.js";
import { ConfigHistoryArea } from "../schemas/config-history-entry.schema.js";

/**
 * PRD-006 Volume-4 §4.2 — `WORKSPACE_UPDATED`/`SETTINGS_UPDATED` only ever
 * carried a `section` marker, never a diff payload, so `newValue` here is
 * always a live read of current state at the moment the triggering event
 * fires (`previousValue` is chained by `ConfigHistoryRepository.record()`
 * itself). `WORKSPACE_UPDATED(section="business_profile")` is deliberately
 * NOT tracked — §4.2's own area list names Business Hours/Notification
 * Settings, not Business Profile. See
 * docs/ADR-SET-007-audit-strategy.md.
 */
@Injectable()
export class ConfigHistoryListener {
  constructor(
    private readonly configHistoryRepository: ConfigHistoryRepository,
    private readonly workspaceSettingsRepository: WorkspaceSettingsRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly webhookConfigRepository: WebhookConfigRepository,
  ) {}

  @OnEvent(DomainEvent.SETTINGS_UPDATED)
  async onSettingsUpdated(payload: SettingsUpdatedPayload): Promise<void> {
    const settings = await this.workspaceSettingsRepository.getOrCreate(payload.workspaceId);
    const area =
      payload.section === "branding" ? ConfigHistoryArea.BRANDING : ConfigHistoryArea.PREFERENCES;
    const newValue =
      payload.section === "branding"
        ? { logoUrl: settings.logoUrl }
        : {
            currency: settings.currency,
            dateFormat: settings.dateFormat,
            timeFormat: settings.timeFormat,
          };

    await this.configHistoryRepository.record({
      workspaceId: payload.workspaceId,
      area,
      newValue,
      changedBy: payload.updatedBy,
    });
  }

  @OnEvent(DomainEvent.WORKSPACE_UPDATED)
  async onWorkspaceUpdated(payload: WorkspaceUpdatedPayload): Promise<void> {
    if (payload.section !== "business_hours" && payload.section !== "notification_settings") {
      return;
    }

    const workspace = await this.workspaceRepository.findById(payload.workspaceId);
    if (!workspace) {
      return;
    }

    const area =
      payload.section === "business_hours"
        ? ConfigHistoryArea.BUSINESS_HOURS
        : ConfigHistoryArea.NOTIFICATION_SETTINGS;
    const newValue =
      payload.section === "business_hours"
        ? { businessHours: workspace.businessHours }
        : { notificationSettings: workspace.notificationSettings };

    await this.configHistoryRepository.record({
      workspaceId: payload.workspaceId,
      area,
      newValue,
      changedBy: payload.updatedBy,
    });
  }

  @OnEvent(DomainEvent.WEBHOOK_CREATED)
  async onWebhookCreated(payload: WebhookCreatedPayload): Promise<void> {
    await this.recordWebhookChange(payload.workspaceId, payload.webhookId, payload.actorId);
  }

  @OnEvent(DomainEvent.WEBHOOK_UPDATED)
  async onWebhookUpdated(payload: WebhookUpdatedPayload): Promise<void> {
    await this.recordWebhookChange(payload.workspaceId, payload.webhookId, payload.actorId);
  }

  @OnEvent(DomainEvent.FEATURE_FLAG_UPDATED)
  async onFeatureFlagUpdated(payload: FeatureFlagUpdatedPayload): Promise<void> {
    await this.configHistoryRepository.record({
      workspaceId: payload.workspaceId,
      area: ConfigHistoryArea.FEATURE_FLAGS,
      newValue: { flagKey: payload.flagKey, enabled: payload.enabled },
      changedBy: payload.actorId,
    });
  }

  private async recordWebhookChange(
    workspaceId: string,
    webhookId: string,
    actorId: string,
  ): Promise<void> {
    const webhook = await this.webhookConfigRepository.findByIdForWorkspace(workspaceId, webhookId);
    if (!webhook) {
      return;
    }

    await this.configHistoryRepository.record({
      workspaceId,
      area: ConfigHistoryArea.INTEGRATIONS,
      newValue: {
        webhookId,
        url: webhook.url,
        enabled: webhook.enabled,
        retryCount: webhook.retryCount,
        timeoutSeconds: webhook.timeoutSeconds,
        events: webhook.events,
      },
      changedBy: actorId,
    });
  }
}
