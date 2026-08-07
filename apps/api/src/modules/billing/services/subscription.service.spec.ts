import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { BillingCycle, SubscriptionStatus, WorkspaceStatus } from "@wapp/shared-types";
import { SubscriptionService } from "./subscription.service.js";
import { SubscriptionRepository } from "../repositories/subscription.repository.js";
import { PlanRepository } from "../repositories/plan.repository.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

const starterPlan = { _id: { toString: () => "plan-starter" }, name: "Starter" };
const growthPlan = { _id: { toString: () => "plan-growth" }, name: "Growth" };

const baseSubscription = {
  _id: { toString: () => "subscription-1" },
  workspaceId: "workspace-1",
  planId: { toString: () => "plan-starter" },
  pendingPlanId: null as { toString(): string } | null,
  status: SubscriptionStatus.TRIAL,
  startDate: new Date("2026-08-01T00:00:00.000Z"),
  renewalDate: new Date("2026-08-15T00:00:00.000Z"),
  trialEndsAt: new Date("2026-08-15T00:00:00.000Z"),
  graceEndsAt: null as Date | null,
  cancelledAt: null as Date | null,
  billingCycle: BillingCycle.MONTHLY,
  autoRenew: true,
  createdBy: "user-1",
  updatedBy: "user-1",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

describe("SubscriptionService", () => {
  let service: SubscriptionService;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let planRepository: jest.Mocked<PlanRepository>;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: SubscriptionRepository,
          useValue: {
            create: jest.fn(),
            findByWorkspace: jest.fn(),
            findById: jest.fn(),
            applyUpgrade: jest.fn(),
            queueDowngrade: jest.fn(),
            applyPendingDowngrade: jest.fn(),
            cancel: jest.fn(),
            updateStatus: jest.fn(),
            startGracePeriod: jest.fn(),
            findExpiredTrials: jest.fn(),
            findLapsedActiveSubscriptions: jest.fn(),
            findExpiredGracePeriods: jest.fn(),
            findDuePendingDowngrades: jest.fn(),
          },
        },
        {
          provide: PlanRepository,
          useValue: { findByName: jest.fn(), findById: jest.fn() },
        },
        { provide: WorkspaceRepository, useValue: { updateStatus: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(SubscriptionService);
    subscriptionRepository = moduleRef.get(SubscriptionRepository);
    planRepository = moduleRef.get(PlanRepository);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("createTrialForWorkspace", () => {
    it("creates a TRIAL Subscription on the Starter plan, syncs Workspace to TRIAL, and emits events", async () => {
      planRepository.findByName.mockResolvedValue(starterPlan as never);
      subscriptionRepository.create.mockResolvedValue(baseSubscription as never);

      const result = await service.createTrialForWorkspace("workspace-1", 14, "user-1");

      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "workspace-1",
          planId: "plan-starter",
          status: SubscriptionStatus.TRIAL,
        }),
      );
      expect(workspaceRepository.updateStatus).toHaveBeenCalledWith(
        "workspace-1",
        WorkspaceStatus.TRIAL,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.SUBSCRIPTION_CREATED,
        expect.objectContaining({ workspaceId: "workspace-1" }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.TRIAL_STARTED,
        expect.objectContaining({ workspaceId: "workspace-1" }),
      );
      expect(result.status).toBe(SubscriptionStatus.TRIAL);
    });

    it("throws when the Starter plan hasn't been seeded yet", async () => {
      planRepository.findByName.mockResolvedValue(null);

      await expect(service.createTrialForWorkspace("workspace-1", 14, "user-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(subscriptionRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("upgrade", () => {
    it("changes plan immediately and, from TRIAL, activates the Subscription (§7 trial-to-paid conversion)", async () => {
      subscriptionRepository.findByWorkspace.mockResolvedValue(baseSubscription as never);
      planRepository.findById.mockResolvedValue(growthPlan as never);
      // applyUpgrade only ever touches planId — deliberately still TRIAL
      // here, so the test fails if the service returns this stale result
      // instead of updateStatus's fresher one (regression coverage for
      // the bug caught during e2e verification).
      subscriptionRepository.applyUpgrade.mockResolvedValue({
        ...baseSubscription,
        planId: { toString: () => "plan-growth" },
        status: SubscriptionStatus.TRIAL,
      } as never);
      subscriptionRepository.updateStatus.mockResolvedValue({
        ...baseSubscription,
        planId: { toString: () => "plan-growth" },
        status: SubscriptionStatus.ACTIVE,
      } as never);

      const result = await service.upgrade("workspace-1", "plan-growth", "user-1");

      expect(subscriptionRepository.applyUpgrade).toHaveBeenCalledWith(
        "subscription-1",
        "plan-growth",
        "user-1",
      );
      expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
        "subscription-1",
        SubscriptionStatus.ACTIVE,
        "user-1",
      );
      expect(workspaceRepository.updateStatus).toHaveBeenCalledWith(
        "workspace-1",
        WorkspaceStatus.ACTIVE,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.SUBSCRIPTION_UPGRADED,
        expect.objectContaining({ previousPlanId: "plan-starter", newPlanId: "plan-growth" }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.SUBSCRIPTION_ACTIVATED,
        expect.anything(),
      );
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it("does not re-emit SUBSCRIPTION_ACTIVATED when already ACTIVE", async () => {
      subscriptionRepository.findByWorkspace.mockResolvedValue({
        ...baseSubscription,
        status: SubscriptionStatus.ACTIVE,
      } as never);
      planRepository.findById.mockResolvedValue(growthPlan as never);
      subscriptionRepository.applyUpgrade.mockResolvedValue({
        ...baseSubscription,
        status: SubscriptionStatus.ACTIVE,
      } as never);

      await service.upgrade("workspace-1", "plan-growth", "user-1");

      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        DomainEvent.SUBSCRIPTION_ACTIVATED,
        expect.anything(),
      );
    });

    it("rejects an invalid Plan", async () => {
      subscriptionRepository.findByWorkspace.mockResolvedValue(baseSubscription as never);
      planRepository.findById.mockResolvedValue(null);

      await expect(service.upgrade("workspace-1", "bogus-plan", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects changing plan while GRACE_PERIOD/SUSPENDED/CANCELLED", async () => {
      subscriptionRepository.findByWorkspace.mockResolvedValue({
        ...baseSubscription,
        status: SubscriptionStatus.SUSPENDED,
      } as never);

      await expect(service.upgrade("workspace-1", "plan-growth", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("downgrade", () => {
    it("queues the plan change rather than applying it immediately", async () => {
      subscriptionRepository.findByWorkspace.mockResolvedValue({
        ...baseSubscription,
        status: SubscriptionStatus.ACTIVE,
      } as never);
      planRepository.findById.mockResolvedValue(starterPlan as never);
      subscriptionRepository.queueDowngrade.mockResolvedValue({
        ...baseSubscription,
        status: SubscriptionStatus.ACTIVE,
        pendingPlanId: { toString: () => "plan-starter" },
      } as never);

      const result = await service.downgrade("workspace-1", "plan-starter", "user-1");

      expect(subscriptionRepository.queueDowngrade).toHaveBeenCalledWith(
        "subscription-1",
        "plan-starter",
        "user-1",
      );
      // Plan/status must NOT change immediately.
      expect(subscriptionRepository.applyUpgrade).not.toHaveBeenCalled();
      expect(subscriptionRepository.updateStatus).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.SUBSCRIPTION_DOWNGRADED,
        expect.objectContaining({ pendingPlanId: "plan-starter" }),
      );
      expect(result.pendingPlanId).toBe("plan-starter");
    });
  });

  describe("cancel", () => {
    it("cancels, syncs Workspace to CANCELLED, and emits SUBSCRIPTION_CANCELLED", async () => {
      subscriptionRepository.findByWorkspace.mockResolvedValue({
        ...baseSubscription,
        status: SubscriptionStatus.ACTIVE,
      } as never);
      subscriptionRepository.cancel.mockResolvedValue({
        ...baseSubscription,
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      } as never);

      const result = await service.cancel("workspace-1", "user-1");

      expect(workspaceRepository.updateStatus).toHaveBeenCalledWith(
        "workspace-1",
        WorkspaceStatus.CANCELLED,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.SUBSCRIPTION_CANCELLED,
        expect.objectContaining({ workspaceId: "workspace-1", actorId: "user-1" }),
      );
      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
    });

    it("rejects cancelling an already-cancelled Subscription", async () => {
      subscriptionRepository.findByWorkspace.mockResolvedValue({
        ...baseSubscription,
        status: SubscriptionStatus.CANCELLED,
      } as never);

      await expect(service.cancel("workspace-1", "user-1")).rejects.toThrow(BadRequestException);
      expect(subscriptionRepository.cancel).not.toHaveBeenCalled();
    });
  });

  describe("expireLapsedTrialsAndActiveSubscriptions", () => {
    it("moves an expired Trial to GRACE_PERIOD, syncs Workspace to EXPIRED, and emits TRIAL_EXPIRED + GRACE_PERIOD_STARTED", async () => {
      subscriptionRepository.findExpiredTrials.mockResolvedValue([baseSubscription as never]);
      subscriptionRepository.findLapsedActiveSubscriptions.mockResolvedValue([]);

      const count = await service.expireLapsedTrialsAndActiveSubscriptions(new Date());

      expect(count).toBe(1);
      expect(subscriptionRepository.startGracePeriod).toHaveBeenCalledWith(
        "subscription-1",
        expect.any(Date),
        "system",
      );
      expect(workspaceRepository.updateStatus).toHaveBeenCalledWith(
        "workspace-1",
        WorkspaceStatus.EXPIRED,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(DomainEvent.TRIAL_EXPIRED, expect.anything());
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.GRACE_PERIOD_STARTED,
        expect.anything(),
      );
    });

    it("moves a lapsed ACTIVE (unrenewed) Subscription to GRACE_PERIOD without emitting TRIAL_EXPIRED", async () => {
      subscriptionRepository.findExpiredTrials.mockResolvedValue([]);
      subscriptionRepository.findLapsedActiveSubscriptions.mockResolvedValue([
        { ...baseSubscription, status: SubscriptionStatus.ACTIVE } as never,
      ]);

      await service.expireLapsedTrialsAndActiveSubscriptions(new Date());

      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        DomainEvent.TRIAL_EXPIRED,
        expect.anything(),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.GRACE_PERIOD_STARTED,
        expect.anything(),
      );
    });
  });

  describe("suspendExpiredGracePeriods", () => {
    it("suspends and syncs Workspace to EXPIRED (not WorkspaceStatus.SUSPENDED, reserved for fraud/abuse)", async () => {
      subscriptionRepository.findExpiredGracePeriods.mockResolvedValue([
        { ...baseSubscription, status: SubscriptionStatus.GRACE_PERIOD } as never,
      ]);

      const count = await service.suspendExpiredGracePeriods(new Date());

      expect(count).toBe(1);
      expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
        "subscription-1",
        SubscriptionStatus.SUSPENDED,
        "system",
      );
      expect(workspaceRepository.updateStatus).toHaveBeenCalledWith(
        "workspace-1",
        WorkspaceStatus.EXPIRED,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.SUBSCRIPTION_SUSPENDED,
        expect.anything(),
      );
    });
  });

  describe("applyDuePendingDowngrades", () => {
    it("applies every due downgrade", async () => {
      subscriptionRepository.findDuePendingDowngrades.mockResolvedValue([
        baseSubscription as never,
      ]);

      const count = await service.applyDuePendingDowngrades(new Date());

      expect(count).toBe(1);
      expect(subscriptionRepository.applyPendingDowngrade).toHaveBeenCalledWith("subscription-1");
    });
  });
});
