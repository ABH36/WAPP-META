import { Test } from "@nestjs/testing";
import { PlanService } from "./plan.service.js";
import { PlanRepository } from "../repositories/plan.repository.js";

describe("PlanService", () => {
  let service: PlanService;
  let planRepository: jest.Mocked<PlanRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlanService,
        {
          provide: PlanRepository,
          useValue: { upsertByName: jest.fn(), findAllActive: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(PlanService);
    planRepository = moduleRef.get(PlanRepository);
  });

  describe("onModuleInit", () => {
    it("idempotently seeds exactly the three approved tiers (Starter/Growth/Enterprise)", async () => {
      planRepository.upsertByName.mockResolvedValue({} as never);

      await service.onModuleInit();

      expect(planRepository.upsertByName).toHaveBeenCalledTimes(3);
      const seededNames = planRepository.upsertByName.mock.calls.map((call) => call[0].name);
      expect(seededNames.sort()).toEqual(["Enterprise", "Growth", "Starter"]);
    });
  });

  describe("listActive", () => {
    it("returns the mapped active Plans", async () => {
      planRepository.findAllActive.mockResolvedValue([
        {
          _id: { toString: () => "plan-1" },
          name: "Starter",
          description: null,
          monthlyPrice: null,
          yearlyPrice: null,
          currency: "INR",
          billingCycle: "MONTHLY",
          isActive: true,
          createdAt: new Date("2026-08-07T00:00:00.000Z"),
          updatedAt: new Date("2026-08-07T00:00:00.000Z"),
        } as never,
      ]);

      const result = await service.listActive();

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Starter");
      expect(result[0]!.monthlyPrice).toBeNull();
    });
  });
});
