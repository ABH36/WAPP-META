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
  TrialStartedPayload,
} from "../../../common/events/domain-events.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { SubscriptionRepository } from "../repositories/subscription.repository.js";
import { PlanRepository } from "../repositories/plan.repository.js";
import { toSubscriptionSummary } from "../mappers/billing.mapper.js";
import type { SubscriptionSummary } from "../billing.types.js";
import type { SubscriptionDocument } from "../schemas/subscription.schema.js";

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
}
