import { Test } from "@nestjs/testing";
import { WorkspaceStatusGateListener } from "./workspace-status-gate.listener.js";
import { WorkspaceMaintenanceStateRepository } from "../repositories/workspace-maintenance-state.repository.js";

describe("WorkspaceStatusGateListener", () => {
  let listener: WorkspaceStatusGateListener;
  let maintenanceStateRepository: jest.Mocked<WorkspaceMaintenanceStateRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceStatusGateListener,
        { provide: WorkspaceMaintenanceStateRepository, useValue: { setLoginBlocked: jest.fn() } },
      ],
    }).compile();

    listener = moduleRef.get(WorkspaceStatusGateListener);
    maintenanceStateRepository = moduleRef.get(WorkspaceMaintenanceStateRepository);
  });

  it("blocks login on WORKSPACE_SUSPENDED", async () => {
    await listener.onSuspended({
      workspaceId: "workspace-1",
      reason: "fraud",
      actorId: "platform-user-1",
      occurredAt: "2026-08-08T00:00:00.000Z",
    });

    expect(maintenanceStateRepository.setLoginBlocked).toHaveBeenCalledWith("workspace-1", true);
  });

  it("unblocks login on WORKSPACE_REACTIVATED", async () => {
    await listener.onReactivated({
      workspaceId: "workspace-1",
      actorId: "platform-user-1",
      occurredAt: "2026-08-08T00:00:00.000Z",
    });

    expect(maintenanceStateRepository.setLoginBlocked).toHaveBeenCalledWith("workspace-1", false);
  });

  it("blocks login on WORKSPACE_ARCHIVED", async () => {
    await listener.onArchived({
      workspaceId: "workspace-1",
      reason: "abandoned",
      actorId: "platform-user-1",
      occurredAt: "2026-08-08T00:00:00.000Z",
    });

    expect(maintenanceStateRepository.setLoginBlocked).toHaveBeenCalledWith("workspace-1", true);
  });
});
