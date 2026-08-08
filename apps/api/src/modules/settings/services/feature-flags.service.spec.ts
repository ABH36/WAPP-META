import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { FeatureFlagsService } from "./feature-flags.service.js";
import { FeatureFlagRepository } from "../repositories/feature-flag.repository.js";
import { PlatformFeatureOverrideRepository } from "../repositories/platform-feature-override.repository.js";
import { FeatureFlagKey } from "../schemas/feature-flag-state.schema.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

describe("FeatureFlagsService", () => {
  let service: FeatureFlagsService;
  let featureFlagRepository: jest.Mocked<FeatureFlagRepository>;
  let platformFeatureOverrideRepository: jest.Mocked<PlatformFeatureOverrideRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        {
          provide: FeatureFlagRepository,
          useValue: { findByWorkspace: jest.fn(), setEnabled: jest.fn() },
        },
        {
          provide: PlatformFeatureOverrideRepository,
          useValue: { findAll: jest.fn(), upsert: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(FeatureFlagsService);
    featureFlagRepository = moduleRef.get(FeatureFlagRepository);
    platformFeatureOverrideRepository = moduleRef.get(PlatformFeatureOverrideRepository);
    eventEmitter = moduleRef.get(EventEmitter2);

    platformFeatureOverrideRepository.findAll.mockResolvedValue([]);
  });

  it("returns all 5 flags, falling back to each key's own default when never toggled", async () => {
    featureFlagRepository.findByWorkspace.mockResolvedValue([
      { flagKey: FeatureFlagKey.BETA_FEATURES, enabled: true } as never,
    ]);

    const result = await service.list("workspace-1");

    expect(result).toHaveLength(5);
    expect(result.find((f) => f.flagKey === FeatureFlagKey.BETA_FEATURES)?.enabled).toBe(true);
    expect(result.find((f) => f.flagKey === FeatureFlagKey.CRM_MODULE)?.enabled).toBe(true);
    expect(result.find((f) => f.flagKey === FeatureFlagKey.AI_ASSISTANT)?.enabled).toBe(false);
  });

  it("setEnabled persists the toggle and emits FEATURE_FLAG_UPDATED", async () => {
    featureFlagRepository.setEnabled.mockResolvedValue({
      flagKey: FeatureFlagKey.BETA_FEATURES,
      enabled: true,
    } as never);

    await service.setEnabled("workspace-1", "user-1", FeatureFlagKey.BETA_FEATURES, true);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.FEATURE_FLAG_UPDATED,
      expect.objectContaining({
        workspaceId: "workspace-1",
        flagKey: FeatureFlagKey.BETA_FEATURES,
        enabled: true,
        actorId: "user-1",
      }),
    );
  });

  describe("platform override tier (PRD-007 Volume-1 §4.5)", () => {
    it("lets a platform override win over the workspace's own toggle", async () => {
      featureFlagRepository.findByWorkspace.mockResolvedValue([
        { flagKey: FeatureFlagKey.CRM_MODULE, enabled: true } as never,
      ]);
      platformFeatureOverrideRepository.findAll.mockResolvedValue([
        { flagKey: FeatureFlagKey.CRM_MODULE, enabled: false } as never,
      ]);

      const result = await service.list("workspace-1");

      expect(result.find((f) => f.flagKey === FeatureFlagKey.CRM_MODULE)?.enabled).toBe(false);
    });

    it("falls back to the workspace toggle when no platform override is set", async () => {
      featureFlagRepository.findByWorkspace.mockResolvedValue([
        { flagKey: FeatureFlagKey.CRM_MODULE, enabled: false } as never,
      ]);
      platformFeatureOverrideRepository.findAll.mockResolvedValue([]);

      const result = await service.list("workspace-1");

      expect(result.find((f) => f.flagKey === FeatureFlagKey.CRM_MODULE)?.enabled).toBe(false);
    });
  });
});
