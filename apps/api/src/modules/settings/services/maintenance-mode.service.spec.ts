import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { MaintenanceModeService } from "./maintenance-mode.service.js";
import { WorkspaceSettingsRepository } from "../repositories/workspace-settings.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

describe("MaintenanceModeService", () => {
  let service: MaintenanceModeService;
  let workspaceSettingsRepository: jest.Mocked<WorkspaceSettingsRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MaintenanceModeService,
        { provide: WorkspaceSettingsRepository, useValue: { updateMaintenanceMode: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(MaintenanceModeService);
    workspaceSettingsRepository = moduleRef.get(WorkspaceSettingsRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  it("emits MAINTENANCE_MODE_ENABLED when turning maintenance on", async () => {
    workspaceSettingsRepository.updateMaintenanceMode.mockResolvedValue({
      maintenanceMode: true,
    } as never);

    const result = await service.setEnabled("workspace-1", "user-1", true);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.MAINTENANCE_MODE_ENABLED,
      expect.objectContaining({ workspaceId: "workspace-1", actorId: "user-1" }),
    );
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      DomainEvent.MAINTENANCE_MODE_DISABLED,
      expect.anything(),
    );
    expect(result).toBe(true);
  });

  it("emits MAINTENANCE_MODE_DISABLED when turning maintenance off", async () => {
    workspaceSettingsRepository.updateMaintenanceMode.mockResolvedValue({
      maintenanceMode: false,
    } as never);

    await service.setEnabled("workspace-1", "user-1", false);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.MAINTENANCE_MODE_DISABLED,
      expect.objectContaining({ workspaceId: "workspace-1" }),
    );
  });
});
