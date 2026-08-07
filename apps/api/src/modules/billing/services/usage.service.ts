import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UsageCounterType, UsageFeature, USAGE_WARNING_THRESHOLDS } from "@wapp/shared-types";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  FeatureDisabledPayload,
  FeatureEnabledPayload,
  UsageLimitExceededPayload,
  UsageThresholdReachedPayload,
  WorkspaceLockedPayload,
  WorkspaceUnlockedPayload,
} from "../../../common/events/domain-events.js";
import { WorkspaceUsageRepository } from "../repositories/workspace-usage.repository.js";
import { PlanLimitsRepository } from "../repositories/plan-limits.repository.js";
import { SubscriptionRepository } from "../repositories/subscription.repository.js";
import { UsageHistoryRepository } from "../repositories/usage-history.repository.js";
import { toPlanLimitsSummary } from "../mappers/billing.mapper.js";
import type { CounterUsageSummary, PlanLimitsSummary, UsageSummary } from "../billing.types.js";
import type { WorkspaceUsageDocument } from "../schemas/workspace-usage.schema.js";
import type { PlanLimitsDocument } from "../schemas/plan-limits.schema.js";

const ALL_COUNTER_TYPES: readonly UsageCounterType[] = Object.values(UsageCounterType);
const ALL_FEATURES: readonly UsageFeature[] = Object.values(UsageFeature);

/**
 * PRD-005 Volume-3 (Usage, Limits & Enforcement). §3 — Usage owns
 * entitlements, counters, limit evaluation, and enforcement decisions;
 * never Subscription/Workspace/Payments/Invoices (BR-001/BR-002). This is
 * "the engine" — resolved 2026-08-07, Architecture Review: retrofitting
 * enforcement into CRM/Communication's own write paths is separate,
 * individually-approved follow-up work, not this volume's scope. `checkX`
 * methods below exist for that future work to call directly (a future
 * business module would inject UsageService, per §15's "Business modules
 * may only query Usage") — nothing in this codebase calls them yet.
 * See docs/ADR-BILL-008-commercial-enforcement-strategy.md.
 */
@Injectable()
export class UsageService {
  constructor(
    private readonly workspaceUsageRepository: WorkspaceUsageRepository,
    private readonly planLimitsRepository: PlanLimitsRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly usageHistoryRepository: UsageHistoryRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getUsage(workspaceId: string): Promise<UsageSummary> {
    const usage = await this.workspaceUsageRepository.getOrCreate(workspaceId);
    const limits = await this.resolvePlanLimits(workspaceId);

    const counters: CounterUsageSummary[] = ALL_COUNTER_TYPES.map((counterType) => {
      const count = this.readCount(usage, counterType);
      const limit = limits ? this.readLimit(limits, counterType) : null;
      const percentage = limit !== null && limit > 0 ? (count / limit) * 100 : null;
      const locked = this.readLocked(usage, counterType);
      return { counterType, count, limit, percentage, locked };
    });

    return { workspaceId, counters };
  }

  async getLimits(workspaceId: string): Promise<PlanLimitsSummary> {
    const limits = await this.resolvePlanLimits(workspaceId);
    if (!limits) {
      throw new Error("No Subscription/Plan/PlanLimits found for this Workspace");
    }
    return toPlanLimitsSummary(limits);
  }

  async getEntitlements(workspaceId: string): Promise<PlanLimitsSummary["entitlements"]> {
    const summary = await this.getLimits(workspaceId);
    return summary.entitlements;
  }

  async getUsageHistory(workspaceId: string) {
    const entries = await this.usageHistoryRepository.list(workspaceId);
    return entries.map((entry) => ({
      id: entry._id.toString(),
      workspaceId: entry.workspaceId,
      eventType: entry.eventType,
      description: entry.description,
      metadata: entry.metadata as Record<string, unknown>,
      occurredAt: entry.occurredAt.toISOString(),
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  /** Read-only — for future business modules to call before executing a mutation. Nothing in this codebase calls it yet (retrofitting is deferred). */
  async checkLimit(
    workspaceId: string,
    counterType: UsageCounterType,
  ): Promise<{ allowed: boolean; currentCount: number; limit: number | null }> {
    const usage = await this.workspaceUsageRepository.getOrCreate(workspaceId);
    const limits = await this.resolvePlanLimits(workspaceId);
    const currentCount = this.readCount(usage, counterType);
    const limit = limits ? this.readLimit(limits, counterType) : null;
    return { allowed: limit === null || currentCount < limit, currentCount, limit };
  }

  /** Read-only — same "for future callers" reasoning as checkLimit. */
  async checkFeatureEnabled(workspaceId: string, feature: UsageFeature): Promise<boolean> {
    const limits = await this.resolvePlanLimits(workspaceId);
    return limits ? this.readEntitlement(limits, feature) : false;
  }

  /**
   * Called by UsageCounterListener after every wired creation-time event
   * (§6's 6 in-scope counters — TD-013 defers the other 3). Increments,
   * then evaluates thresholds/exceeded/locked against the Workspace's
   * current Plan limit.
   */
  async recordCreation(workspaceId: string, counterType: UsageCounterType): Promise<void> {
    const usage = await this.workspaceUsageRepository.incrementCounter(workspaceId, counterType);
    const limits = await this.resolvePlanLimits(workspaceId);
    if (!limits) {
      return;
    }

    const count = this.readCount(usage, counterType);
    const limit = this.readLimit(limits, counterType);
    if (limit === null) {
      // Not yet approved (TD-014) — nothing to enforce or warn about.
      return;
    }

    const now = new Date();
    if (count > limit) {
      this.eventEmitter.emit(DomainEvent.USAGE_LIMIT_EXCEEDED, {
        workspaceId,
        counterType,
        currentCount: count,
        limit,
        occurredAt: now.toISOString(),
      } satisfies UsageLimitExceededPayload);

      if (!this.readLocked(usage, counterType)) {
        await this.workspaceUsageRepository.setLocked(workspaceId, counterType, true);
        this.eventEmitter.emit(DomainEvent.WORKSPACE_LOCKED, {
          workspaceId,
          counterType,
          occurredAt: now.toISOString(),
        } satisfies WorkspaceLockedPayload);
      }
      return;
    }

    const percentage = (count / limit) * 100;
    const crossed = USAGE_WARNING_THRESHOLDS.filter((threshold) => percentage >= threshold);
    const highestCrossed = crossed.length > 0 ? Math.max(...crossed) : null;
    const lastNotified = this.readLastThresholdNotified(usage, counterType);

    if (highestCrossed !== null && highestCrossed > (lastNotified ?? 0)) {
      await this.workspaceUsageRepository.setLastThresholdNotified(
        workspaceId,
        counterType,
        highestCrossed,
      );
      this.eventEmitter.emit(DomainEvent.USAGE_THRESHOLD_REACHED, {
        workspaceId,
        counterType,
        threshold: highestCrossed,
        currentCount: count,
        limit,
        occurredAt: now.toISOString(),
      } satisfies UsageThresholdReachedPayload);
    }
  }

  /**
   * Called by PlanChangeUsageListener on SUBSCRIPTION_UPGRADED. Diffs old
   * vs new Plan's entitlements/limits symmetrically (upgrade() is used for
   * any immediate plan change in this codebase, not only "more expensive"
   * ones — see docs/ADR-BILL-008-commercial-enforcement-strategy.md) —
   * covers both a feature/limit newly granted and one newly revoked.
   */
  async handlePlanChange(
    workspaceId: string,
    previousPlanId: string,
    newPlanId: string,
  ): Promise<void> {
    const [oldLimits, newLimits, usage] = await Promise.all([
      this.planLimitsRepository.findByPlanId(previousPlanId),
      this.planLimitsRepository.findByPlanId(newPlanId),
      this.workspaceUsageRepository.getOrCreate(workspaceId),
    ]);
    if (!oldLimits || !newLimits) {
      return;
    }

    const now = new Date().toISOString();

    for (const feature of ALL_FEATURES) {
      const wasEnabled = this.readEntitlement(oldLimits, feature);
      const isEnabled = this.readEntitlement(newLimits, feature);
      if (!wasEnabled && isEnabled) {
        this.eventEmitter.emit(DomainEvent.FEATURE_ENABLED, {
          workspaceId,
          feature,
          occurredAt: now,
        } satisfies FeatureEnabledPayload);
      } else if (wasEnabled && !isEnabled) {
        this.eventEmitter.emit(DomainEvent.FEATURE_DISABLED, {
          workspaceId,
          feature,
          occurredAt: now,
        } satisfies FeatureDisabledPayload);
      }
    }

    for (const counterType of TRACKED_COUNTER_TYPES) {
      const count = this.readCount(usage, counterType);
      const oldLimit = this.readLimit(oldLimits, counterType);
      const newLimit = this.readLimit(newLimits, counterType);
      const wasLocked = oldLimit !== null && count > oldLimit;
      const isLocked = newLimit !== null && count > newLimit;

      if (wasLocked && !isLocked) {
        await this.workspaceUsageRepository.setLocked(workspaceId, counterType, false);
        this.eventEmitter.emit(DomainEvent.WORKSPACE_UNLOCKED, {
          workspaceId,
          counterType,
          occurredAt: now,
        } satisfies WorkspaceUnlockedPayload);
      } else if (!wasLocked && isLocked) {
        await this.workspaceUsageRepository.setLocked(workspaceId, counterType, true);
        this.eventEmitter.emit(DomainEvent.WORKSPACE_LOCKED, {
          workspaceId,
          counterType,
          occurredAt: now,
        } satisfies WorkspaceLockedPayload);
      }
    }
  }

  private async resolvePlanLimits(workspaceId: string): Promise<PlanLimitsDocument | null> {
    const subscription = await this.subscriptionRepository.findByWorkspace(workspaceId);
    if (!subscription) {
      return null;
    }
    return this.planLimitsRepository.findByPlanId(subscription.planId.toString());
  }

  private readCount(usage: WorkspaceUsageDocument, counterType: UsageCounterType): number {
    switch (counterType) {
      case UsageCounterType.TEAM_MEMBERS:
        return usage.teamMembersCount;
      case UsageCounterType.CUSTOMERS:
        return usage.customersCount;
      case UsageCounterType.LEADS:
        return usage.leadsCount;
      case UsageCounterType.DEALS:
        return usage.dealsCount;
      case UsageCounterType.BROADCASTS:
        return usage.broadcastsCount;
      case UsageCounterType.CAMPAIGNS:
        return usage.campaignsCount;
      case UsageCounterType.MESSAGES:
        return usage.messagesCount;
      case UsageCounterType.STORAGE:
        return usage.storageCount;
      case UsageCounterType.API_REQUESTS:
        return usage.apiRequestsCount;
    }
  }

  private readLocked(usage: WorkspaceUsageDocument, counterType: UsageCounterType): boolean {
    switch (counterType) {
      case UsageCounterType.TEAM_MEMBERS:
        return usage.teamMembersLocked;
      case UsageCounterType.CUSTOMERS:
        return usage.customersLocked;
      case UsageCounterType.LEADS:
        return usage.leadsLocked;
      case UsageCounterType.DEALS:
        return usage.dealsLocked;
      case UsageCounterType.BROADCASTS:
        return usage.broadcastsLocked;
      case UsageCounterType.MESSAGES:
        return usage.messagesLocked;
      default:
        return false;
    }
  }

  private readLastThresholdNotified(
    usage: WorkspaceUsageDocument,
    counterType: UsageCounterType,
  ): number | null {
    switch (counterType) {
      case UsageCounterType.TEAM_MEMBERS:
        return usage.teamMembersLastThresholdNotified;
      case UsageCounterType.CUSTOMERS:
        return usage.customersLastThresholdNotified;
      case UsageCounterType.LEADS:
        return usage.leadsLastThresholdNotified;
      case UsageCounterType.DEALS:
        return usage.dealsLastThresholdNotified;
      case UsageCounterType.BROADCASTS:
        return usage.broadcastsLastThresholdNotified;
      case UsageCounterType.MESSAGES:
        return usage.messagesLastThresholdNotified;
      default:
        return null;
    }
  }

  private readLimit(limits: PlanLimitsDocument, counterType: UsageCounterType): number | null {
    switch (counterType) {
      case UsageCounterType.TEAM_MEMBERS:
        return limits.teamMembersLimit;
      case UsageCounterType.CUSTOMERS:
        return limits.customersLimit;
      case UsageCounterType.LEADS:
        return limits.leadsLimit;
      case UsageCounterType.DEALS:
        return limits.dealsLimit;
      case UsageCounterType.BROADCASTS:
        return limits.broadcastsLimit;
      case UsageCounterType.CAMPAIGNS:
        return limits.campaignsLimit;
      case UsageCounterType.MESSAGES:
        return limits.messagesLimit;
      case UsageCounterType.STORAGE:
        return limits.storageLimit;
      case UsageCounterType.API_REQUESTS:
        return limits.apiRequestsLimit;
    }
  }

  private readEntitlement(limits: PlanLimitsDocument, feature: UsageFeature): boolean {
    switch (feature) {
      case UsageFeature.CRM:
        return limits.crmEnabled;
      case UsageFeature.BROADCAST:
        return limits.broadcastEnabled;
      case UsageFeature.CAMPAIGNS:
        return limits.campaignsEnabled;
      case UsageFeature.AUTOMATION:
        return limits.automationEnabled;
      case UsageFeature.TEAM_MEMBERS:
        return limits.teamMembersEnabled;
      case UsageFeature.REPORTS:
        return limits.reportsEnabled;
      case UsageFeature.API_ACCESS:
        return limits.apiAccessEnabled;
      case UsageFeature.WEBHOOKS:
        return limits.webhooksEnabled;
      case UsageFeature.INTEGRATIONS:
        return limits.integrationsEnabled;
    }
  }
}

const TRACKED_COUNTER_TYPES: readonly UsageCounterType[] = [
  UsageCounterType.TEAM_MEMBERS,
  UsageCounterType.CUSTOMERS,
  UsageCounterType.LEADS,
  UsageCounterType.DEALS,
  UsageCounterType.BROADCASTS,
  UsageCounterType.MESSAGES,
];
