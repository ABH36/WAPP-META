import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UsageCounterType, UsageFeature } from "@wapp/shared-types";
import { UsageService } from "./usage.service.js";
import { WorkspaceUsageRepository } from "../repositories/workspace-usage.repository.js";
import { PlanLimitsRepository } from "../repositories/plan-limits.repository.js";
import { SubscriptionRepository } from "../repositories/subscription.repository.js";
import { UsageHistoryRepository } from "../repositories/usage-history.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

const subscription = { planId: { toString: () => "plan-growth" } };

const baseUsage = {
  workspaceId: "workspace-1",
  teamMembersCount: 0,
  customersCount: 0,
  leadsCount: 0,
  dealsCount: 0,
  broadcastsCount: 0,
  campaignsCount: 0,
  messagesCount: 0,
  storageCount: 0,
  apiRequestsCount: 0,
  teamMembersLastThresholdNotified: null as number | null,
  customersLastThresholdNotified: null as number | null,
  leadsLastThresholdNotified: null as number | null,
  dealsLastThresholdNotified: null as number | null,
  broadcastsLastThresholdNotified: null as number | null,
  messagesLastThresholdNotified: null as number | null,
  teamMembersLocked: false,
  customersLocked: false,
  leadsLocked: false,
  dealsLocked: false,
  broadcastsLocked: false,
  messagesLocked: false,
};

const baseLimits = {
  crmEnabled: true,
  broadcastEnabled: true,
  campaignsEnabled: true,
  automationEnabled: true,
  teamMembersEnabled: true,
  reportsEnabled: true,
  apiAccessEnabled: true,
  webhooksEnabled: true,
  integrationsEnabled: true,
  teamMembersLimit: null as number | null,
  customersLimit: null as number | null,
  leadsLimit: null as number | null,
  dealsLimit: null as number | null,
  broadcastsLimit: null as number | null,
  campaignsLimit: null as number | null,
  messagesLimit: null as number | null,
  storageLimit: null as number | null,
  apiRequestsLimit: null as number | null,
};

describe("UsageService", () => {
  let service: UsageService;
  let workspaceUsageRepository: jest.Mocked<WorkspaceUsageRepository>;
  let planLimitsRepository: jest.Mocked<PlanLimitsRepository>;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsageService,
        {
          provide: WorkspaceUsageRepository,
          useValue: {
            findByWorkspace: jest.fn(),
            getOrCreate: jest.fn(),
            incrementCounter: jest.fn(),
            setLastThresholdNotified: jest.fn(),
            setLocked: jest.fn(),
          },
        },
        { provide: PlanLimitsRepository, useValue: { findByPlanId: jest.fn() } },
        { provide: SubscriptionRepository, useValue: { findByWorkspace: jest.fn() } },
        { provide: UsageHistoryRepository, useValue: { list: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(UsageService);
    workspaceUsageRepository = moduleRef.get(WorkspaceUsageRepository);
    planLimitsRepository = moduleRef.get(PlanLimitsRepository);
    subscriptionRepository = moduleRef.get(SubscriptionRepository);
    eventEmitter = moduleRef.get(EventEmitter2);

    subscriptionRepository.findByWorkspace.mockResolvedValue(subscription as never);
  });

  describe("checkLimit", () => {
    it("allows when the limit is null (unlimited/not yet approved, TD-014)", async () => {
      workspaceUsageRepository.getOrCreate.mockResolvedValue({
        ...baseUsage,
        customersCount: 500,
      } as never);
      planLimitsRepository.findByPlanId.mockResolvedValue(baseLimits as never);

      const result = await service.checkLimit("workspace-1", UsageCounterType.CUSTOMERS);

      expect(result).toEqual({ allowed: true, currentCount: 500, limit: null });
    });

    it("rejects once current usage reaches the limit (§8 resolved: reject only once usage would exceed it)", async () => {
      workspaceUsageRepository.getOrCreate.mockResolvedValue({
        ...baseUsage,
        customersCount: 10,
      } as never);
      planLimitsRepository.findByPlanId.mockResolvedValue({
        ...baseLimits,
        customersLimit: 10,
      } as never);

      const result = await service.checkLimit("workspace-1", UsageCounterType.CUSTOMERS);

      expect(result).toEqual({ allowed: false, currentCount: 10, limit: 10 });
    });
  });

  describe("checkFeatureEnabled", () => {
    it("reads the entitlement flag for the resolved Plan", async () => {
      planLimitsRepository.findByPlanId.mockResolvedValue({
        ...baseLimits,
        automationEnabled: false,
      } as never);

      const result = await service.checkFeatureEnabled("workspace-1", UsageFeature.AUTOMATION);

      expect(result).toBe(false);
    });
  });

  describe("recordCreation", () => {
    it("increments the counter and emits nothing when the limit is null (TD-014)", async () => {
      workspaceUsageRepository.incrementCounter.mockResolvedValue({
        ...baseUsage,
        customersCount: 1,
      } as never);
      planLimitsRepository.findByPlanId.mockResolvedValue(baseLimits as never);

      await service.recordCreation("workspace-1", UsageCounterType.CUSTOMERS);

      expect(workspaceUsageRepository.incrementCounter).toHaveBeenCalledWith(
        "workspace-1",
        UsageCounterType.CUSTOMERS,
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("emits USAGE_THRESHOLD_REACHED once when crossing 80%, and doesn't re-emit for the same threshold", async () => {
      workspaceUsageRepository.incrementCounter.mockResolvedValue({
        ...baseUsage,
        customersCount: 8,
      } as never);
      planLimitsRepository.findByPlanId.mockResolvedValue({
        ...baseLimits,
        customersLimit: 10,
      } as never);

      await service.recordCreation("workspace-1", UsageCounterType.CUSTOMERS);

      expect(workspaceUsageRepository.setLastThresholdNotified).toHaveBeenCalledWith(
        "workspace-1",
        UsageCounterType.CUSTOMERS,
        80,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.USAGE_THRESHOLD_REACHED,
        expect.objectContaining({ counterType: UsageCounterType.CUSTOMERS, threshold: 80 }),
      );
    });

    it("does not re-notify a threshold already crossed", async () => {
      workspaceUsageRepository.incrementCounter.mockResolvedValue({
        ...baseUsage,
        customersCount: 8,
        customersLastThresholdNotified: 80,
      } as never);
      planLimitsRepository.findByPlanId.mockResolvedValue({
        ...baseLimits,
        customersLimit: 10,
      } as never);

      await service.recordCreation("workspace-1", UsageCounterType.CUSTOMERS);

      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        DomainEvent.USAGE_THRESHOLD_REACHED,
        expect.anything(),
      );
    });

    it("emits USAGE_LIMIT_EXCEEDED and WORKSPACE_LOCKED the first time a limit is exceeded", async () => {
      workspaceUsageRepository.incrementCounter.mockResolvedValue({
        ...baseUsage,
        customersCount: 11,
        customersLocked: false,
      } as never);
      planLimitsRepository.findByPlanId.mockResolvedValue({
        ...baseLimits,
        customersLimit: 10,
      } as never);

      await service.recordCreation("workspace-1", UsageCounterType.CUSTOMERS);

      expect(workspaceUsageRepository.setLocked).toHaveBeenCalledWith(
        "workspace-1",
        UsageCounterType.CUSTOMERS,
        true,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.USAGE_LIMIT_EXCEEDED,
        expect.objectContaining({ currentCount: 11, limit: 10 }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.WORKSPACE_LOCKED,
        expect.objectContaining({ counterType: UsageCounterType.CUSTOMERS }),
      );
    });

    it("does not re-emit WORKSPACE_LOCKED once already locked", async () => {
      workspaceUsageRepository.incrementCounter.mockResolvedValue({
        ...baseUsage,
        customersCount: 12,
        customersLocked: true,
      } as never);
      planLimitsRepository.findByPlanId.mockResolvedValue({
        ...baseLimits,
        customersLimit: 10,
      } as never);

      await service.recordCreation("workspace-1", UsageCounterType.CUSTOMERS);

      expect(workspaceUsageRepository.setLocked).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        DomainEvent.WORKSPACE_LOCKED,
        expect.anything(),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.USAGE_LIMIT_EXCEEDED,
        expect.anything(),
      );
    });
  });

  describe("handlePlanChange", () => {
    it("emits FEATURE_DISABLED when the new Plan revokes a capability the old one granted", async () => {
      planLimitsRepository.findByPlanId
        .mockResolvedValueOnce({ ...baseLimits, automationEnabled: true } as never)
        .mockResolvedValueOnce({ ...baseLimits, automationEnabled: false } as never);
      workspaceUsageRepository.getOrCreate.mockResolvedValue(baseUsage as never);

      await service.handlePlanChange("workspace-1", "plan-old", "plan-new");

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.FEATURE_DISABLED,
        expect.objectContaining({ feature: UsageFeature.AUTOMATION }),
      );
    });

    it("emits FEATURE_ENABLED when the new Plan grants a capability the old one lacked", async () => {
      planLimitsRepository.findByPlanId
        .mockResolvedValueOnce({ ...baseLimits, webhooksEnabled: false } as never)
        .mockResolvedValueOnce({ ...baseLimits, webhooksEnabled: true } as never);
      workspaceUsageRepository.getOrCreate.mockResolvedValue(baseUsage as never);

      await service.handlePlanChange("workspace-1", "plan-old", "plan-new");

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.FEATURE_ENABLED,
        expect.objectContaining({ feature: UsageFeature.WEBHOOKS }),
      );
    });

    it("emits WORKSPACE_UNLOCKED when the new Plan's limit rises above current usage", async () => {
      planLimitsRepository.findByPlanId
        .mockResolvedValueOnce({ ...baseLimits, customersLimit: 10 } as never)
        .mockResolvedValueOnce({ ...baseLimits, customersLimit: 100 } as never);
      workspaceUsageRepository.getOrCreate.mockResolvedValue({
        ...baseUsage,
        customersCount: 15,
        customersLocked: true,
      } as never);

      await service.handlePlanChange("workspace-1", "plan-old", "plan-new");

      expect(workspaceUsageRepository.setLocked).toHaveBeenCalledWith(
        "workspace-1",
        UsageCounterType.CUSTOMERS,
        false,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.WORKSPACE_UNLOCKED,
        expect.objectContaining({ counterType: UsageCounterType.CUSTOMERS }),
      );
    });

    it("emits WORKSPACE_LOCKED when the new Plan's limit falls below current usage", async () => {
      planLimitsRepository.findByPlanId
        .mockResolvedValueOnce({ ...baseLimits, customersLimit: 100 } as never)
        .mockResolvedValueOnce({ ...baseLimits, customersLimit: 10 } as never);
      workspaceUsageRepository.getOrCreate.mockResolvedValue({
        ...baseUsage,
        customersCount: 15,
        customersLocked: false,
      } as never);

      await service.handlePlanChange("workspace-1", "plan-old", "plan-new");

      expect(workspaceUsageRepository.setLocked).toHaveBeenCalledWith(
        "workspace-1",
        UsageCounterType.CUSTOMERS,
        true,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.WORKSPACE_LOCKED,
        expect.objectContaining({ counterType: UsageCounterType.CUSTOMERS }),
      );
    });

    it("no-ops (no events, no lock changes) when either Plan's limits can't be found", async () => {
      planLimitsRepository.findByPlanId.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      workspaceUsageRepository.getOrCreate.mockResolvedValue(baseUsage as never);

      await service.handlePlanChange("workspace-1", "plan-old", "plan-new");

      expect(workspaceUsageRepository.setLocked).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe("getUsage", () => {
    it("returns all 9 counters, with deferred ones (Campaigns/Storage/API Requests) always at limit null", async () => {
      workspaceUsageRepository.getOrCreate.mockResolvedValue({
        ...baseUsage,
        customersCount: 3,
      } as never);
      planLimitsRepository.findByPlanId.mockResolvedValue({
        ...baseLimits,
        customersLimit: 10,
      } as never);

      const result = await service.getUsage("workspace-1");

      expect(result.counters).toHaveLength(9);
      const customers = result.counters.find((c) => c.counterType === UsageCounterType.CUSTOMERS)!;
      expect(customers).toEqual({
        counterType: UsageCounterType.CUSTOMERS,
        count: 3,
        limit: 10,
        percentage: 30,
        locked: false,
      });
      const campaigns = result.counters.find((c) => c.counterType === UsageCounterType.CAMPAIGNS)!;
      expect(campaigns.limit).toBeNull();
      expect(campaigns.percentage).toBeNull();
    });
  });
});
