import { Test } from "@nestjs/testing";
import { PlanChangeUsageListener } from "./plan-change-usage.listener.js";
import { UsageService } from "../services/usage.service.js";

describe("PlanChangeUsageListener", () => {
  let listener: PlanChangeUsageListener;
  let usageService: jest.Mocked<UsageService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlanChangeUsageListener,
        { provide: UsageService, useValue: { handlePlanChange: jest.fn() } },
      ],
    }).compile();

    listener = moduleRef.get(PlanChangeUsageListener);
    usageService = moduleRef.get(UsageService);
  });

  it("diffs entitlements/limits on every SUBSCRIPTION_UPGRADED", async () => {
    await listener.onSubscriptionUpgraded({
      workspaceId: "workspace-1",
      subscriptionId: "subscription-1",
      previousPlanId: "plan-starter",
      newPlanId: "plan-growth",
      actorId: "user-1",
      occurredAt: new Date().toISOString(),
    });

    expect(usageService.handlePlanChange).toHaveBeenCalledWith(
      "workspace-1",
      "plan-starter",
      "plan-growth",
    );
  });
});
