import { Test } from "@nestjs/testing";
import { PlatformFeatureOverrideListener } from "./platform-feature-override.listener.js";
import { PlatformFeatureOverrideRepository } from "../repositories/platform-feature-override.repository.js";
import { FeatureFlagKey } from "../schemas/feature-flag-state.schema.js";

describe("PlatformFeatureOverrideListener", () => {
  let listener: PlatformFeatureOverrideListener;
  let overrideRepository: jest.Mocked<PlatformFeatureOverrideRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformFeatureOverrideListener,
        { provide: PlatformFeatureOverrideRepository, useValue: { upsert: jest.fn() } },
      ],
    }).compile();

    listener = moduleRef.get(PlatformFeatureOverrideListener);
    overrideRepository = moduleRef.get(PlatformFeatureOverrideRepository);
  });

  it("upserts the local read model on PLATFORM_FEATURE_UPDATED", async () => {
    await listener.onPlatformFeatureUpdated({
      flagKey: FeatureFlagKey.AI_ASSISTANT,
      enabled: true,
      actorId: "platform-user-1",
      occurredAt: "2026-08-08T00:00:00.000Z",
    });

    expect(overrideRepository.upsert).toHaveBeenCalledWith(FeatureFlagKey.AI_ASSISTANT, true);
  });
});
