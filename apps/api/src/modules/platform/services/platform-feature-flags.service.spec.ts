import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PlatformFeatureFlagsService } from "./platform-feature-flags.service.js";
import { PlatformFeatureFlagOverrideRepository } from "../repositories/platform-feature-flag-override.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import { FeatureFlagKey } from "../../settings/schemas/feature-flag-state.schema.js";

describe("PlatformFeatureFlagsService", () => {
  let service: PlatformFeatureFlagsService;
  let overrideRepository: jest.Mocked<PlatformFeatureFlagOverrideRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformFeatureFlagsService,
        {
          provide: PlatformFeatureFlagOverrideRepository,
          useValue: { findAll: jest.fn(), setEnabled: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformFeatureFlagsService);
    overrideRepository = moduleRef.get(PlatformFeatureFlagOverrideRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  it("returns all 5 flags with null for any key with no platform override", async () => {
    overrideRepository.findAll.mockResolvedValue([
      { flagKey: FeatureFlagKey.BETA_FEATURES, enabled: true } as never,
    ]);

    const result = await service.list();

    expect(result).toHaveLength(5);
    expect(result.find((f) => f.flagKey === FeatureFlagKey.BETA_FEATURES)?.enabled).toBe(true);
    expect(result.find((f) => f.flagKey === FeatureFlagKey.CRM_MODULE)?.enabled).toBeNull();
  });

  it("setEnabled persists the override and emits PLATFORM_FEATURE_UPDATED", async () => {
    overrideRepository.setEnabled.mockResolvedValue({} as never);

    await service.setEnabled(FeatureFlagKey.AI_ASSISTANT, false, "platform-user-1");

    expect(overrideRepository.setEnabled).toHaveBeenCalledWith(
      FeatureFlagKey.AI_ASSISTANT,
      false,
      "platform-user-1",
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.PLATFORM_FEATURE_UPDATED,
      expect.objectContaining({
        flagKey: FeatureFlagKey.AI_ASSISTANT,
        enabled: false,
        actorId: "platform-user-1",
      }),
    );
  });
});
