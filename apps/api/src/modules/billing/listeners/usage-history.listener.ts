import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  FeatureDisabledPayload,
  FeatureEnabledPayload,
  UsageLimitExceededPayload,
  UsageThresholdReachedPayload,
  WorkspaceLockedPayload,
  WorkspaceUnlockedPayload,
} from "../../../common/events/domain-events.js";
import { UsageHistoryService } from "../services/usage-history.service.js";

/**
 * §13 (GET /billing/usage/history). One explicit @OnEvent handler per Usage
 * event, same precedent already applied to BillingHistoryListener
 * (DomainEventLoggerListener's own doc comment: EventEmitter2 wildcard
 * listeners don't reliably survive NestJS class-method wrapping) — no
 * "usage.*" wildcard.
 */
@Injectable()
export class UsageHistoryListener {
  constructor(private readonly usageHistoryService: UsageHistoryService) {}

  @OnEvent(DomainEvent.USAGE_THRESHOLD_REACHED)
  async onUsageThresholdReached(payload: UsageThresholdReachedPayload): Promise<void> {
    await this.record(
      payload,
      DomainEvent.USAGE_THRESHOLD_REACHED,
      `Usage Threshold Reached (${payload.counterType} at ${payload.threshold}%)`,
    );
  }

  @OnEvent(DomainEvent.USAGE_LIMIT_EXCEEDED)
  async onUsageLimitExceeded(payload: UsageLimitExceededPayload): Promise<void> {
    await this.record(
      payload,
      DomainEvent.USAGE_LIMIT_EXCEEDED,
      `Usage Limit Exceeded (${payload.counterType})`,
    );
  }

  @OnEvent(DomainEvent.FEATURE_ENABLED)
  async onFeatureEnabled(payload: FeatureEnabledPayload): Promise<void> {
    await this.record(payload, DomainEvent.FEATURE_ENABLED, `Feature Enabled (${payload.feature})`);
  }

  @OnEvent(DomainEvent.FEATURE_DISABLED)
  async onFeatureDisabled(payload: FeatureDisabledPayload): Promise<void> {
    await this.record(
      payload,
      DomainEvent.FEATURE_DISABLED,
      `Feature Disabled (${payload.feature})`,
    );
  }

  @OnEvent(DomainEvent.WORKSPACE_LOCKED)
  async onWorkspaceLocked(payload: WorkspaceLockedPayload): Promise<void> {
    await this.record(
      payload,
      DomainEvent.WORKSPACE_LOCKED,
      `Workspace Locked (${payload.counterType})`,
    );
  }

  @OnEvent(DomainEvent.WORKSPACE_UNLOCKED)
  async onWorkspaceUnlocked(payload: WorkspaceUnlockedPayload): Promise<void> {
    await this.record(
      payload,
      DomainEvent.WORKSPACE_UNLOCKED,
      `Workspace Unlocked (${payload.counterType})`,
    );
  }

  private async record(
    payload: { workspaceId: string; occurredAt: string },
    eventType: string,
    description: string,
  ): Promise<void> {
    await this.usageHistoryService.record(
      payload.workspaceId,
      eventType,
      description,
      payload,
      new Date(payload.occurredAt),
    );
  }
}
