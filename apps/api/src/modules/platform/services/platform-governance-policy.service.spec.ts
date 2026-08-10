import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException } from "@nestjs/common";
import { PlatformGovernancePolicyService } from "./platform-governance-policy.service.js";
import { GovernancePolicyRepository } from "../repositories/governance-policy.repository.js";
import { GovernancePolicyKey } from "../schemas/governance-policy.schema.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { GovernancePolicyDocument } from "../schemas/governance-policy.schema.js";

function fakePolicy(overrides: Partial<Record<string, unknown>> = {}): GovernancePolicyDocument {
  const base = {
    key: GovernancePolicyKey.SESSION_TIMEOUT,
    value: { tenantAccessTtlMinutes: 15 },
    version: 1,
    reason: "Initial configuration",
    updatedBy: "super-1",
    history: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
  return base as unknown as GovernancePolicyDocument;
}

describe("PlatformGovernancePolicyService", () => {
  let service: PlatformGovernancePolicyService;
  let governancePolicyRepository: jest.Mocked<GovernancePolicyRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformGovernancePolicyService,
        {
          provide: GovernancePolicyRepository,
          useValue: { list: jest.fn(), upsertByKey: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformGovernancePolicyService);
    governancePolicyRepository = moduleRef.get(GovernancePolicyRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("list", () => {
    it("maps every persisted policy", async () => {
      governancePolicyRepository.list.mockResolvedValue([fakePolicy()]);

      const result = await service.list();

      expect(result).toHaveLength(1);
      expect(result[0]?.key).toBe(GovernancePolicyKey.SESSION_TIMEOUT);
    });
  });

  describe("update", () => {
    it("upserts the policy and emits PLATFORM_POLICY_UPDATED", async () => {
      governancePolicyRepository.upsertByKey.mockResolvedValue(fakePolicy({ version: 2 }));

      const result = await service.update(
        GovernancePolicyKey.SESSION_TIMEOUT,
        { value: { tenantAccessTtlMinutes: 30 }, reason: "Tightening session duration" },
        "super-1",
      );

      expect(governancePolicyRepository.upsertByKey).toHaveBeenCalledWith(
        GovernancePolicyKey.SESSION_TIMEOUT,
        { tenantAccessTtlMinutes: 30 },
        "Tightening session duration",
        "super-1",
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.PLATFORM_POLICY_UPDATED,
        expect.objectContaining({
          policyKey: GovernancePolicyKey.SESSION_TIMEOUT,
          version: 2,
          reason: "Tightening session duration",
          actorId: "super-1",
        }),
      );
      expect(result.version).toBe(2);
    });

    it("rejects an unknown policy key without touching the repository", async () => {
      await expect(
        service.update("NOT_A_REAL_KEY", { value: {}, reason: "irrelevant" }, "super-1"),
      ).rejects.toThrow(BadRequestException);
      expect(governancePolicyRepository.upsertByKey).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("rejects BREAK_GLASS_DURATION-shaped keys the same as any other unknown key (excluded from the enum, ADR-PLAT-005)", async () => {
      await expect(
        service.update(
          "BREAK_GLASS_DURATION",
          { value: { minutes: 480 }, reason: "irrelevant" },
          "super-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
