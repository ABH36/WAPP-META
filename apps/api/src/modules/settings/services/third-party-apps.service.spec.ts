import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ThirdPartyAppsService } from "./third-party-apps.service.js";
import { ThirdPartyAppRepository } from "../repositories/third-party-app.repository.js";
import { ThirdPartyAppKey } from "../schemas/third-party-app.schema.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

describe("ThirdPartyAppsService", () => {
  let service: ThirdPartyAppsService;
  let thirdPartyAppRepository: jest.Mocked<ThirdPartyAppRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ThirdPartyAppsService,
        {
          provide: ThirdPartyAppRepository,
          useValue: { findByWorkspace: jest.fn(), setEnabled: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        MetricsService,
      ],
    }).compile();

    service = moduleRef.get(ThirdPartyAppsService);
    thirdPartyAppRepository = moduleRef.get(ThirdPartyAppRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("list", () => {
    it("returns all 4 apps, defaulting to disabled for any never toggled", async () => {
      thirdPartyAppRepository.findByWorkspace.mockResolvedValue([
        { appKey: ThirdPartyAppKey.ZAPIER, enabled: true } as never,
      ]);

      const result = await service.list("workspace-1");

      expect(result).toHaveLength(4);
      expect(result.find((app) => app.appKey === ThirdPartyAppKey.ZAPIER)?.enabled).toBe(true);
      expect(result.find((app) => app.appKey === ThirdPartyAppKey.MAKE)?.enabled).toBe(false);
    });
  });

  describe("setEnabled", () => {
    it("emits INTEGRATION_CONNECTED when enabling", async () => {
      thirdPartyAppRepository.setEnabled.mockResolvedValue({
        appKey: ThirdPartyAppKey.ZAPIER,
        enabled: true,
      } as never);

      await service.setEnabled("workspace-1", "user-1", ThirdPartyAppKey.ZAPIER, true);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.INTEGRATION_CONNECTED,
        expect.objectContaining({ integrationType: "THIRD_PARTY_APP", actorId: "user-1" }),
      );
    });

    it("emits INTEGRATION_DISCONNECTED when disabling", async () => {
      thirdPartyAppRepository.setEnabled.mockResolvedValue({
        appKey: ThirdPartyAppKey.ZAPIER,
        enabled: false,
      } as never);

      await service.setEnabled("workspace-1", "user-1", ThirdPartyAppKey.ZAPIER, false);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.INTEGRATION_DISCONNECTED,
        expect.objectContaining({ integrationType: "THIRD_PARTY_APP" }),
      );
    });
  });
});
