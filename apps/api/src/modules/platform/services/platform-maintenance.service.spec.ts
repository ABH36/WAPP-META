import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PlatformMaintenanceService } from "./platform-maintenance.service.js";
import { PlatformMaintenanceStateRepository } from "../repositories/platform-maintenance-state.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

describe("PlatformMaintenanceService", () => {
  let service: PlatformMaintenanceService;
  let stateRepository: jest.Mocked<PlatformMaintenanceStateRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformMaintenanceService,
        {
          provide: PlatformMaintenanceStateRepository,
          useValue: { get: jest.fn(), setEnabled: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformMaintenanceService);
    stateRepository = moduleRef.get(PlatformMaintenanceStateRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("getStatus", () => {
    it("returns disabled/null defaults when no state document exists yet", async () => {
      stateRepository.get.mockResolvedValue(null);

      const result = await service.getStatus();

      expect(result).toEqual({ enabled: false, reason: null });
    });

    it("returns the persisted state", async () => {
      stateRepository.get.mockResolvedValue({ enabled: true, reason: "Planned upgrade" } as never);

      const result = await service.getStatus();

      expect(result).toEqual({ enabled: true, reason: "Planned upgrade" });
    });
  });

  describe("setEnabled", () => {
    it("emits PLATFORM_MAINTENANCE_ENABLED when turning maintenance on", async () => {
      stateRepository.setEnabled.mockResolvedValue({ enabled: true, reason: "Upgrade" } as never);

      const result = await service.setEnabled(true, "Upgrade", "platform-user-1");

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.PLATFORM_MAINTENANCE_ENABLED,
        expect.objectContaining({ actorId: "platform-user-1" }),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        DomainEvent.PLATFORM_MAINTENANCE_DISABLED,
        expect.anything(),
      );
      expect(result).toEqual({ enabled: true, reason: "Upgrade" });
    });

    it("emits PLATFORM_MAINTENANCE_DISABLED when turning maintenance off", async () => {
      stateRepository.setEnabled.mockResolvedValue({ enabled: false, reason: null } as never);

      await service.setEnabled(false, null, "platform-user-1");

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.PLATFORM_MAINTENANCE_DISABLED,
        expect.objectContaining({ actorId: "platform-user-1" }),
      );
    });
  });
});
