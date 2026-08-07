import { Test } from "@nestjs/testing";
import { PlanLimitsService } from "./plan-limits.service.js";
import { PlanLimitsRepository } from "../repositories/plan-limits.repository.js";
import { PlanRepository } from "../repositories/plan.repository.js";
import { PlanService } from "./plan.service.js";

describe("PlanLimitsService", () => {
  let service: PlanLimitsService;
  let planLimitsRepository: jest.Mocked<PlanLimitsRepository>;
  let planRepository: jest.Mocked<PlanRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlanLimitsService,
        {
          provide: PlanLimitsRepository,
          useValue: { findByPlanId: jest.fn(), upsertByPlanId: jest.fn() },
        },
        { provide: PlanRepository, useValue: { findByName: jest.fn() } },
        { provide: PlanService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(PlanLimitsService);
    planLimitsRepository = moduleRef.get(PlanLimitsRepository);
    planRepository = moduleRef.get(PlanRepository);
  });

  describe("onModuleInit", () => {
    it("seeds PlanLimits for each of the three Plans it can find", async () => {
      planRepository.findByName.mockImplementation((name: string) =>
        Promise.resolve({ _id: { toString: () => `plan-${name.toLowerCase()}` } } as never),
      );

      await service.onModuleInit();

      expect(planLimitsRepository.upsertByPlanId).toHaveBeenCalledTimes(3);
      expect(planLimitsRepository.upsertByPlanId).toHaveBeenCalledWith({ planId: "plan-starter" });
      expect(planLimitsRepository.upsertByPlanId).toHaveBeenCalledWith({ planId: "plan-growth" });
      expect(planLimitsRepository.upsertByPlanId).toHaveBeenCalledWith({
        planId: "plan-enterprise",
      });
    });

    it("skips a Plan that hasn't been seeded yet rather than throwing", async () => {
      planRepository.findByName.mockResolvedValue(null);

      await expect(service.onModuleInit()).resolves.not.toThrow();
      expect(planLimitsRepository.upsertByPlanId).not.toHaveBeenCalled();
    });
  });
});
