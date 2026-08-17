import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SubscriptionStatus } from "@wapp/shared-types";
import { PlatformSubscriptionsService } from "./platform-subscriptions.service.js";
import { SubscriptionService } from "../../billing/services/subscription.service.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

const baseSummary = {
  id: "subscription-1",
  workspaceId: "workspace-1",
  planId: "plan-starter",
  status: SubscriptionStatus.ACTIVE,
};

describe("PlatformSubscriptionsService", () => {
  let service: PlatformSubscriptionsService;
  let subscriptionService: jest.Mocked<SubscriptionService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformSubscriptionsService,
        {
          provide: SubscriptionService,
          useValue: {
            listAllForPlatform: jest.fn(),
            getByIdForPlatform: jest.fn(),
            extendTrial: jest.fn(),
            upgradeById: jest.fn(),
            downgradeById: jest.fn(),
            operatorSetStatus: jest.fn(),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformSubscriptionsService);
    subscriptionService = moduleRef.get(SubscriptionService);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  it("list() delegates to listAllForPlatform", async () => {
    subscriptionService.listAllForPlatform.mockResolvedValue({ items: [], total: 0 });

    await service.list({ workspaceId: "workspace-1" }, 1, 20);

    expect(subscriptionService.listAllForPlatform).toHaveBeenCalledWith(
      { workspaceId: "workspace-1" },
      1,
      20,
    );
  });

  it("clamps an oversized limit to MAX_PAGE_SIZE (100) instead of passing it through unbounded", async () => {
    subscriptionService.listAllForPlatform.mockResolvedValue({ items: [], total: 0 });

    await service.list({}, 1, 999_999);

    expect(subscriptionService.listAllForPlatform).toHaveBeenCalledWith({}, 1, 100);
  });

  it("extendTrial() delegates to SubscriptionService.extendTrial", async () => {
    subscriptionService.extendTrial.mockResolvedValue(baseSummary as never);

    await service.extendTrial("subscription-1", 30, "reason", "op-1");

    expect(subscriptionService.extendTrial).toHaveBeenCalledWith(
      "subscription-1",
      30,
      "reason",
      "op-1",
    );
  });

  describe("changePlan", () => {
    it("calls upgradeById when immediate and emits PLAN_CHANGED_BY_OPERATOR", async () => {
      subscriptionService.getByIdForPlatform.mockResolvedValue({
        ...baseSummary,
        planId: "plan-starter",
      } as never);
      subscriptionService.upgradeById.mockResolvedValue({
        ...baseSummary,
        planId: "plan-growth",
      } as never);

      const result = await service.changePlan("subscription-1", "plan-growth", true, "op-1");

      expect(subscriptionService.upgradeById).toHaveBeenCalledWith(
        "subscription-1",
        "plan-growth",
        "op-1",
      );
      expect(subscriptionService.downgradeById).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.PLAN_CHANGED_BY_OPERATOR,
        expect.objectContaining({
          subscriptionId: "subscription-1",
          previousPlanId: "plan-starter",
          newPlanId: "plan-growth",
          immediate: true,
          actorId: "op-1",
        }),
      );
      expect(result.planId).toBe("plan-growth");
    });

    it("calls downgradeById when not immediate", async () => {
      subscriptionService.getByIdForPlatform.mockResolvedValue(baseSummary as never);
      subscriptionService.downgradeById.mockResolvedValue(baseSummary as never);

      await service.changePlan("subscription-1", "plan-starter", false, "op-1");

      expect(subscriptionService.downgradeById).toHaveBeenCalledWith(
        "subscription-1",
        "plan-starter",
        "op-1",
      );
      expect(subscriptionService.upgradeById).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.PLAN_CHANGED_BY_OPERATOR,
        expect.objectContaining({ immediate: false }),
      );
    });
  });

  it("updateStatus() delegates to operatorSetStatus", async () => {
    subscriptionService.operatorSetStatus.mockResolvedValue(baseSummary as never);

    await service.updateStatus("subscription-1", SubscriptionStatus.SUSPENDED, "op-1");

    expect(subscriptionService.operatorSetStatus).toHaveBeenCalledWith(
      "subscription-1",
      SubscriptionStatus.SUSPENDED,
      "op-1",
    );
  });
});
