import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SystemPreferencesService } from "./system-preferences.service.js";
import { WorkspaceSettingsRepository } from "../repositories/workspace-settings.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import { ExportFormat } from "../schemas/export-job.schema.js";

describe("SystemPreferencesService", () => {
  let service: SystemPreferencesService;
  let workspaceSettingsRepository: jest.Mocked<WorkspaceSettingsRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SystemPreferencesService,
        {
          provide: WorkspaceSettingsRepository,
          useValue: { getOrCreate: jest.fn(), updateSystemPreferences: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(SystemPreferencesService);
    workspaceSettingsRepository = moduleRef.get(WorkspaceSettingsRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  it("get returns the current preferences", async () => {
    workspaceSettingsRepository.getOrCreate.mockResolvedValue({
      defaultPagination: 25,
      exportFormat: ExportFormat.CSV,
      dashboardRefreshInterval: 60,
    } as never);

    const result = await service.get("workspace-1");
    expect(result).toEqual({
      defaultPagination: 25,
      exportFormat: ExportFormat.CSV,
      dashboardRefreshInterval: 60,
    });
  });

  it("update persists the change and emits SYSTEM_PREFERENCE_UPDATED", async () => {
    workspaceSettingsRepository.updateSystemPreferences.mockResolvedValue({
      defaultPagination: 50,
      exportFormat: ExportFormat.EXCEL,
      dashboardRefreshInterval: 120,
    } as never);

    const result = await service.update("workspace-1", "user-1", { defaultPagination: 50 });

    expect(workspaceSettingsRepository.updateSystemPreferences).toHaveBeenCalledWith(
      "workspace-1",
      {
        defaultPagination: 50,
      },
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.SYSTEM_PREFERENCE_UPDATED,
      expect.objectContaining({ workspaceId: "workspace-1", actorId: "user-1" }),
    );
    expect(result.defaultPagination).toBe(50);
  });
});
