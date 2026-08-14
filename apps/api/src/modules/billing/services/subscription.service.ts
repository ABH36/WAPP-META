import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  BillingCycle,
  SUBSCRIPTION_GRACE_PERIOD_DAYS,
  SubscriptionStatus,
  WorkspaceStatus,
} from "@wapp/shared-types";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  GracePeriodStartedPayload,
  SubscriptionActivatedPayload,
  SubscriptionCancelledPayload,
  SubscriptionCreatedPayload,
  SubscriptionDowngradedPayload,
  SubscriptionSuspendedPayload,
  SubscriptionUpgradedPayload,
  TrialExpiredPayload,
  TrialExtendedPayload,
  TrialStartedPayload,
} from "../../../common/events/domain-events.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import {
  ListSubscriptionsForPlatformFilter,
  ListSubscriptionsForPlatformResult as RepositoryListSubscriptionsResult,
  SubscriptionRepository,
} from "../repositories/subscription.repository.js";
import { PlanRepository } from "../repositories/plan.repository.js";
import { toSubscriptionSummary } from "../mappers/billing.mapper.js";
import type { SubscriptionSummary } from "../billing.types.js";
import type { SubscriptionDocument } from "../schemas/subscription.schema.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

const MAX_TRIAL_EXTENSION_DAYS = 90;

/** PRD-007 Volume-2 §4.1 — operator-driven targets only; TRIAL/GRACE_PERIOD are never a direct operator-write target (Trial ends via Extend/conversion, Grace Period is system-only). */
export const OPERATOR_ASSIGNABLE_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.SUSPENDED,
  SubscriptionStatus.CANCELLED,
];

export interface ListSubscriptionsForPlatformResult {
  items: SubscriptionSummary[];
  total: number;
}

/**
 * PRD-005 Volume-1 (Subscription & Plans). Sole owner of trial tracking
 * (resolved 2026-08-07 — WorkspaceService no longer computes trialEndsAt;
 * `createTrialForWorkspace` below is invoked reactively by
 * WorkspaceCreatedListener on WORKSPACE_CREATED, never called directly by
 * WorkspaceService, keeping the dependency one-directional: Billing depends
 * on Workspace, never the reverse) — see
 * docs/ADR-BILL-001-subscription-ownership-strategy.md.
 *
 * Drives Workspace.status directly via WorkspaceRepository (same
 * synchronous-call-then-emit-event shape LeadConversionService already
 * established for CustomerRepository) rather than a fully decoupled
 * listener — Workspace.status is access-control-critical and must be
 * correct immediately, not eventually — see
 * docs/ADR-BILL-002-workspace-billing-synchronization.md.
 */
@Injectable()
export class SubscriptionService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {}

  /** §7 — BR-002, one trial per Workspace; called exactly once, reactively, at Workspace creation. */
  async createTrialForWorkspace(
    workspaceId: string,
    trialDurationDays: number,
    actorId: string,
  ): Promise<SubscriptionSummary> {
    const starterPlan = await this.planRepository.findByName("Starter");
    if (!starterPlan) {
      throw new NotFoundException(
        "Starter plan not found — plan catalog seed may not have run yet",
      );
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + trialDurationDays * 86_400_000);

    const created = await this.subscriptionRepository.create({
      workspaceId,
      planId: starterPlan._id.toString(),
      status: SubscriptionStatus.TRIAL,
      startDate: now,
      renewalDate: trialEndsAt,
      trialEndsAt,
      billingCycle: BillingCycle.MONTHLY,
      createdBy: actorId,
    });

    await this.syncWorkspaceStatus(workspaceId, WorkspaceStatus.TRIAL);

    this.eventEmitter.emit(DomainEvent.SUBSCRIPTION_CREATED, {
      workspaceId,
      subscriptionId: created._id.toString(),
      planId: starterPlan._id.toString(),
      occurredAt: now.toISOString(),
    } satisfies SubscriptionCreatedPayload);
    this.eventEmitter.emit(DomainEvent.TRIAL_STARTED, {
      workspaceId,
      subscriptionId: created._id.toString(),
      trialEndsAt: trialEndsAt.toISOString(),
      occurredAt: now.toISOString(),
    } satisfies TrialStartedPayload);

    return toSubscriptionSummary(created);
  }

  async getForWorkspace(workspaceId: string): Promise<SubscriptionSummary> {
    const subscription = await this.findOrThrow(workspaceId);
    return toSubscriptionSummary(subscription);
  }

  /**
   * §8/§7 — immediate. Also the mechanism by which a TRIAL converts to
   * ACTIVE ("Trial converts into Active only through Billing completion") —
   * there is no separate "convert trial" action, upgrading a TRIAL
   * subscription IS that completion.
   */
  async upgrade(
    workspaceId: string,
    planId: string,
    actorId: string,
  ): Promise<SubscriptionSummary> {
    const subscription = await this.findOrThrow(workspaceId);
    this.ensureUpgradeDowngradeEligible(subscription);
    await this.ensurePlanExists(planId);

    const previousPlanId = subscription.planId.toString();
    let updated = await this.subscriptionRepository.applyUpgrade(
      subscription._id.toString(),
      planId,
      actorId,
    );
    if (!updated) {
      throw new NotFoundException("Subscription not found");
    }

    // applyUpgrade only ever touches planId/pendingPlanId — the status
    // transition below is a separate write, so `updated` must be
    // refreshed from it or the returned summary would still show the
    // pre-activation status (caught during e2e verification: a TRIAL
    // Subscription upgrading to a paid plan came back as "TRIAL", not
    // "ACTIVE", because the stale first result was returned regardless).
    const wasNotActive = subscription.status !== SubscriptionStatus.ACTIVE;
    if (wasNotActive) {
      updated = await this.subscriptionRepository.updateStatus(
        subscription._id.toString(),
        SubscriptionStatus.ACTIVE,
        actorId,
      );
      if (!updated) {
        throw new NotFoundException("Subscription not found");
      }
      await this.syncWorkspaceStatus(workspaceId, WorkspaceStatus.ACTIVE);
    }

    const now = new Date().toISOString();
    this.eventEmitter.emit(DomainEvent.SUBSCRIPTION_UPGRADED, {
      workspaceId,
      subscriptionId: subscription._id.toString(),
      previousPlanId,
      newPlanId: planId,
      actorId,
      occurredAt: now,
    } satisfies SubscriptionUpgradedPayload);
    if (wasNotActive) {
      this.eventEmitter.emit(DomainEvent.SUBSCRIPTION_ACTIVATED, {
        workspaceId,
        subscriptionId: subscription._id.toString(),
        planId,
        occurredAt: now,
      } satisfies SubscriptionActivatedPayload);
    }
    this.metricsService.billingSubscriptionChangesTotal.inc({ type: "upgrade" });

    return toSubscriptionSummary(updated);
  }

  /** §9 — queued, applied at renewalDate by the lifecycle sweep, never immediately. */
  async downgrade(
    workspaceId: string,
    planId: string,
    actorId: string,
  ): Promise<SubscriptionSummary> {
    const subscription = await this.findOrThrow(workspaceId);
    this.ensureUpgradeDowngradeEligible(subscription);
    await this.ensurePlanExists(planId);

    const updated = await this.subscriptionRepository.queueDowngrade(
      subscription._id.toString(),
      planId,
      actorId,
    );
    if (!updated) {
      throw new NotFoundException("Subscription not found");
    }

    this.eventEmitter.emit(DomainEvent.SUBSCRIPTION_DOWNGRADED, {
      workspaceId,
      subscriptionId: subscription._id.toString(),
      previousPlanId: subscription.planId.toString(),
      pendingPlanId: planId,
      effectiveAt: subscription.renewalDate.toISOString(),
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies SubscriptionDowngradedPayload);
    this.metricsService.billingSubscriptionChangesTotal.inc({ type: "downgrade" });

    return toSubscriptionSummary(updated);
  }

  /** §10 — preserves historical data (BR-003), never removes Workspace data. */
  async cancel(workspaceId: string, actorId: string): Promise<SubscriptionSummary> {
    const subscription = await this.findOrThrow(workspaceId);
    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException("Subscription is already cancelled");
    }

    const updated = await this.subscriptionRepository.cancel(subscription._id.toString(), actorId);
    if (!updated) {
      throw new NotFoundException("Subscription not found");
    }

    await this.syncWorkspaceStatus(workspaceId, WorkspaceStatus.CANCELLED);

    this.eventEmitter.emit(DomainEvent.SUBSCRIPTION_CANCELLED, {
      workspaceId,
      subscriptionId: subscription._id.toString(),
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies SubscriptionCancelledPayload);
    this.metricsService.billingSubscriptionChangesTotal.inc({ type: "cancel" });

    return toSubscriptionSummary(updated);
  }

  // ---- PRD-007 Volume-2 — Platform Billing Operations (id-based entry
  // points; Platform Administration never has a workspaceId to hand in the
  // way a tenant's own JWT provides one, only the Subscription's own id
  // from the route). Every one of these resolves workspaceId then delegates
  // to the tenant-facing method above — no duplicate commercial logic
  // (BR-006/§11). ----

  async getByIdForPlatform(subscriptionId: string): Promise<SubscriptionSummary> {
    const subscription = await this.findByIdOrThrow(subscriptionId);
    return toSubscriptionSummary(subscription);
  }

  async upgradeById(
    subscriptionId: string,
    planId: string,
    actorId: string,
  ): Promise<SubscriptionSummary> {
    const subscription = await this.findByIdOrThrow(subscriptionId);
    return this.upgrade(subscription.workspaceId, planId, actorId);
  }

  async downgradeById(
    subscriptionId: string,
    planId: string,
    actorId: string,
  ): Promise<SubscriptionSummary> {
    const subscription = await this.findByIdOrThrow(subscriptionId);
    return this.downgrade(subscription.workspaceId, planId, actorId);
  }

  async cancelById(subscriptionId: string, actorId: string): Promise<SubscriptionSummary> {
    const subscription = await this.findByIdOrThrow(subscriptionId);
    return this.cancel(subscription.workspaceId, actorId);
  }

  /** §4.4/§10 — BR-003 requires a reason; validation caps a single extension at 90 days. Only a TRIAL Subscription has a trial to extend. */
  async extendTrial(
    subscriptionId: string,
    days: number,
    reason: string,
    actorId: string,
  ): Promise<SubscriptionSummary> {
    if (days < 1 || days > MAX_TRIAL_EXTENSION_DAYS) {
      throw new BadRequestException(
        `Trial extension must be between 1 and ${MAX_TRIAL_EXTENSION_DAYS} days`,
      );
    }

    const subscription = await this.findByIdOrThrow(subscriptionId);
    if (subscription.status !== SubscriptionStatus.TRIAL) {
      throw new BadRequestException("Only a Subscription in TRIAL can have its trial extended");
    }

    const previousTrialEndsAt = subscription.trialEndsAt!;
    const newTrialEndsAt = new Date(previousTrialEndsAt.getTime() + days * 86_400_000);

    const updated = await this.subscriptionRepository.extendTrial(
      subscriptionId,
      newTrialEndsAt,
      actorId,
    );
    if (!updated) {
      throw new NotFoundException("Subscription not found");
    }

    this.eventEmitter.emit(DomainEvent.TRIAL_EXTENDED, {
      workspaceId: subscription.workspaceId,
      subscriptionId,
      previousTrialEndsAt: previousTrialEndsAt.toISOString(),
      newTrialEndsAt: newTrialEndsAt.toISOString(),
      reason,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies TrialExtendedPayload);

    return toSubscriptionSummary(updated);
  }

  /**
   * §4.1/§9 — the single generic status-transition endpoint (Architecture
   * Review, 2026-08-08) covering Activate/Resume (both -> ACTIVE),
   * Suspend (-> SUSPENDED), and Cancel (-> CANCELLED). An operator-driven
   * Suspend is a distinct concept from Volume-1's Workspace-level Suspend
   * (`PlatformWorkspaceRegistryService.suspend`, fraud/abuse, maps to
   * `WorkspaceStatus.SUSPENDED`) — this is a billing-cause suspension of
   * the Subscription itself, reusing the exact `WorkspaceStatus.EXPIRED`
   * mapping the system's own non-payment suspend sweep already uses
   * (ADR-BILL-002). See docs/ADR-PLAT-003-platform-billing-operations-boundary.md.
   */
  async operatorSetStatus(
    subscriptionId: string,
    targetStatus: SubscriptionStatus,
    actorId: string,
  ): Promise<SubscriptionSummary> {
    if (targetStatus === SubscriptionStatus.CANCELLED) {
      return this.cancelById(subscriptionId, actorId);
    }

    const subscription = await this.findByIdOrThrow(subscriptionId);

    if (targetStatus === SubscriptionStatus.ACTIVE) {
      return this.operatorActivate(subscription, actorId);
    }
    if (targetStatus === SubscriptionStatus.SUSPENDED) {
      return this.operatorSuspend(subscription, actorId);
    }

    throw new BadRequestException(`Unsupported target status: ${targetStatus}`);
  }

  /** PRD-007 Volume-2 §4.1/§9 — cross-tenant list (also composes §4.5's Customer Support view when filtered by workspaceId). */
  async listAllForPlatform(
    filter: ListSubscriptionsForPlatformFilter,
    page: number,
    limit: number,
  ): Promise<ListSubscriptionsForPlatformResult> {
    const { items, total }: RepositoryListSubscriptionsResult =
      await this.subscriptionRepository.listAllForPlatform(filter, page, limit);
    return { items: items.map(toSubscriptionSummary), total };
  }

  /** PRD-007 Volume-2 §4.7 (Billing Dashboard). */
  async countByStatusForPlatform(status: SubscriptionStatus): Promise<number> {
    return this.subscriptionRepository.countByStatus(status);
  }

  private async operatorActivate(
    subscription: SubscriptionDocument,
    actorId: string,
  ): Promise<SubscriptionSummary> {
    if (subscription.status === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException("Subscription is already ACTIVE");
    }
    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException("A cancelled Subscription cannot be activated");
    }

    const subscriptionId = subscription._id.toString();
    const updated = await this.subscriptionRepository.updateStatus(
      subscriptionId,
      SubscriptionStatus.ACTIVE,
      actorId,
    );
    if (!updated) {
      throw new NotFoundException("Subscription not found");
    }
    await this.syncWorkspaceStatus(subscription.workspaceId, WorkspaceStatus.ACTIVE);

    this.eventEmitter.emit(DomainEvent.SUBSCRIPTION_ACTIVATED, {
      workspaceId: subscription.workspaceId,
      subscriptionId,
      planId: subscription.planId.toString(),
      occurredAt: new Date().toISOString(),
    } satisfies SubscriptionActivatedPayload);

    return toSubscriptionSummary(updated);
  }

  /** Restricted to ACTIVE/GRACE_PERIOD — matches the only precondition the system's own non-payment suspend sweep already allows (findExpiredGracePeriods). */
  private async operatorSuspend(
    subscription: SubscriptionDocument,
    actorId: string,
  ): Promise<SubscriptionSummary> {
    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.GRACE_PERIOD
    ) {
      throw new BadRequestException(`Cannot suspend a Subscription that is ${subscription.status}`);
    }

    const subscriptionId = subscription._id.toString();
    const updated = await this.subscriptionRepository.updateStatus(
      subscriptionId,
      SubscriptionStatus.SUSPENDED,
      actorId,
    );
    if (!updated) {
      throw new NotFoundException("Subscription not found");
    }
    // Same WorkspaceStatus target the system's own non-payment suspend sweep uses (ADR-BILL-002) — SUSPENDED (SubscriptionStatus) is a billing-cause state, never WorkspaceStatus.SUSPENDED (reserved for fraud/abuse, Volume-1).
    await this.syncWorkspaceStatus(subscription.workspaceId, WorkspaceStatus.EXPIRED);

    this.eventEmitter.emit(DomainEvent.SUBSCRIPTION_SUSPENDED, {
      workspaceId: subscription.workspaceId,
      subscriptionId,
      occurredAt: new Date().toISOString(),
    } satisfies SubscriptionSuspendedPayload);

    return toSubscriptionSummary(updated);
  }

  // ---- Lifecycle sweep support (SubscriptionLifecycleProcessor) ----

  /**
   * §4/§7 — TRIAL past trialEndsAt, or ACTIVE past renewalDate with no
   * Payments module yet to confirm a charge: both move to GRACE_PERIOD the
   * same way. Returns the number of Subscriptions moved.
   */
  async expireLapsedTrialsAndActiveSubscriptions(now: Date): Promise<number> {
    const [expiredTrials, lapsedActive] = await Promise.all([
      this.subscriptionRepository.findExpiredTrials(now),
      this.subscriptionRepository.findLapsedActiveSubscriptions(now),
    ]);
    const candidates = [...expiredTrials, ...lapsedActive];

    for (const subscription of candidates) {
      const wasTrial = subscription.status === SubscriptionStatus.TRIAL;
      const graceEndsAt = new Date(now.getTime() + SUBSCRIPTION_GRACE_PERIOD_DAYS * 86_400_000);
      await this.subscriptionRepository.startGracePeriod(
        subscription._id.toString(),
        graceEndsAt,
        "system",
      );
      await this.syncWorkspaceStatus(subscription.workspaceId, WorkspaceStatus.EXPIRED);

      const occurredAt = now.toISOString();
      if (wasTrial) {
        this.eventEmitter.emit(DomainEvent.TRIAL_EXPIRED, {
          workspaceId: subscription.workspaceId,
          subscriptionId: subscription._id.toString(),
          occurredAt,
        } satisfies TrialExpiredPayload);
      }
      this.eventEmitter.emit(DomainEvent.GRACE_PERIOD_STARTED, {
        workspaceId: subscription.workspaceId,
        subscriptionId: subscription._id.toString(),
        graceEndsAt: graceEndsAt.toISOString(),
        occurredAt,
      } satisfies GracePeriodStartedPayload);
    }

    return candidates.length;
  }

  /** §11 — Grace Period past graceEndsAt, still unpaid: moves to Suspended. Non-payment cause maps to Workspace EXPIRED, not WorkspaceStatus.SUSPENDED (reserved for fraud/abuse). */
  async suspendExpiredGracePeriods(now: Date): Promise<number> {
    const candidates = await this.subscriptionRepository.findExpiredGracePeriods(now);

    for (const subscription of candidates) {
      await this.subscriptionRepository.updateStatus(
        subscription._id.toString(),
        SubscriptionStatus.SUSPENDED,
        "system",
      );
      await this.syncWorkspaceStatus(subscription.workspaceId, WorkspaceStatus.EXPIRED);

      this.eventEmitter.emit(DomainEvent.SUBSCRIPTION_SUSPENDED, {
        workspaceId: subscription.workspaceId,
        subscriptionId: subscription._id.toString(),
        occurredAt: now.toISOString(),
      } satisfies SubscriptionSuspendedPayload);
    }

    return candidates.length;
  }

  /** §9 — applies any downgrade whose renewalDate has arrived. */
  async applyDuePendingDowngrades(now: Date): Promise<number> {
    const candidates = await this.subscriptionRepository.findDuePendingDowngrades(now);
    for (const subscription of candidates) {
      await this.subscriptionRepository.applyPendingDowngrade(subscription._id.toString());
    }
    return candidates.length;
  }

  private ensureUpgradeDowngradeEligible(subscription: SubscriptionDocument): void {
    if (
      subscription.status !== SubscriptionStatus.TRIAL &&
      subscription.status !== SubscriptionStatus.ACTIVE
    ) {
      throw new BadRequestException(
        `Cannot change plan while Subscription is ${subscription.status}`,
      );
    }
  }

  private async ensurePlanExists(planId: string): Promise<void> {
    const plan = await this.planRepository.findById(planId);
    if (!plan) {
      throw new BadRequestException("Invalid Plan");
    }
  }

  private async syncWorkspaceStatus(workspaceId: string, status: WorkspaceStatus): Promise<void> {
    await this.workspaceRepository.updateStatus(workspaceId, status);
  }

  private async findOrThrow(workspaceId: string): Promise<SubscriptionDocument> {
    const subscription = await this.subscriptionRepository.findByWorkspace(workspaceId);
    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }
    return subscription;
  }

  private async findByIdOrThrow(subscriptionId: string): Promise<SubscriptionDocument> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }
    return subscription;
  }
}
