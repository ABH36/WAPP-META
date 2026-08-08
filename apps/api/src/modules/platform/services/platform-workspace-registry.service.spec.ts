import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WorkspaceStatus } from "@wapp/shared-types";
import { PlatformWorkspaceRegistryService } from "./platform-workspace-registry.service.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { WorkspaceDocument } from "../../workspace/schemas/workspace.schema.js";

function fakeWorkspace(overrides: Partial<Record<string, unknown>> = {}): WorkspaceDocument {
  const base = {
    _id: { toString: () => "workspace-1" },
    name: "Acme Retail",
    ownerId: { toString: () => "owner-1" },
    status: WorkspaceStatus.ACTIVE,
    statusReason: null,
    statusChangedAt: null,
    statusChangedBy: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
  return base as unknown as WorkspaceDocument;
}

describe("PlatformWorkspaceRegistryService", () => {
  let service: PlatformWorkspaceRegistryService;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformWorkspaceRegistryService,
        {
          provide: WorkspaceRepository,
          useValue: {
            listAllForPlatform: jest.fn(),
            findById: jest.fn(),
            updateStatusWithReason: jest.fn(),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformWorkspaceRegistryService);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("list", () => {
    it("delegates to the repository and echoes back page/limit", async () => {
      const workspace = fakeWorkspace();
      workspaceRepository.listAllForPlatform.mockResolvedValue({ items: [workspace], total: 1 });

      const result = await service.list({ q: "acme" }, 2, 10);

      expect(workspaceRepository.listAllForPlatform).toHaveBeenCalledWith({ q: "acme" }, 2, 10);
      expect(result).toEqual({
        items: [expect.objectContaining({ id: "workspace-1", name: "Acme Retail" })],
        total: 1,
        page: 2,
        limit: 10,
      });
    });
  });

  describe("suspend", () => {
    it("suspends an active workspace and emits WORKSPACE_SUSPENDED", async () => {
      workspaceRepository.findById.mockResolvedValue(fakeWorkspace());
      workspaceRepository.updateStatusWithReason.mockResolvedValue(
        fakeWorkspace({ status: WorkspaceStatus.SUSPENDED }),
      );

      await service.suspend("workspace-1", "Chargeback dispute", "platform-user-1");

      expect(workspaceRepository.updateStatusWithReason).toHaveBeenCalledWith(
        "workspace-1",
        WorkspaceStatus.SUSPENDED,
        "Chargeback dispute",
        "platform-user-1",
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.WORKSPACE_SUSPENDED,
        expect.objectContaining({ workspaceId: "workspace-1", reason: "Chargeback dispute" }),
      );
    });

    it("rejects suspending an already-suspended workspace", async () => {
      workspaceRepository.findById.mockResolvedValue(
        fakeWorkspace({ status: WorkspaceStatus.SUSPENDED }),
      );

      await expect(service.suspend("workspace-1", "reason", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(workspaceRepository.updateStatusWithReason).not.toHaveBeenCalled();
    });

    it("rejects suspending an archived workspace", async () => {
      workspaceRepository.findById.mockResolvedValue(
        fakeWorkspace({ status: WorkspaceStatus.ARCHIVED }),
      );

      await expect(service.suspend("workspace-1", "reason", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws NotFoundException for a missing workspace", async () => {
      workspaceRepository.findById.mockResolvedValue(null);

      await expect(service.suspend("missing", "reason", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("reactivate", () => {
    it("reactivates a suspended workspace back to ACTIVE and emits WORKSPACE_REACTIVATED", async () => {
      workspaceRepository.findById.mockResolvedValue(
        fakeWorkspace({ status: WorkspaceStatus.SUSPENDED }),
      );
      workspaceRepository.updateStatusWithReason.mockResolvedValue(fakeWorkspace());

      await service.reactivate("workspace-1", "platform-user-1");

      expect(workspaceRepository.updateStatusWithReason).toHaveBeenCalledWith(
        "workspace-1",
        WorkspaceStatus.ACTIVE,
        null,
        "platform-user-1",
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.WORKSPACE_REACTIVATED,
        expect.objectContaining({ workspaceId: "workspace-1" }),
      );
    });

    it("rejects reactivating a workspace that isn't suspended", async () => {
      workspaceRepository.findById.mockResolvedValue(
        fakeWorkspace({ status: WorkspaceStatus.ACTIVE }),
      );

      await expect(service.reactivate("workspace-1", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("archive", () => {
    it("archives a workspace and emits WORKSPACE_ARCHIVED", async () => {
      workspaceRepository.findById.mockResolvedValue(fakeWorkspace());
      workspaceRepository.updateStatusWithReason.mockResolvedValue(
        fakeWorkspace({ status: WorkspaceStatus.ARCHIVED }),
      );

      await service.archive("workspace-1", "Abandoned test account", "platform-user-1");

      expect(workspaceRepository.updateStatusWithReason).toHaveBeenCalledWith(
        "workspace-1",
        WorkspaceStatus.ARCHIVED,
        "Abandoned test account",
        "platform-user-1",
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.WORKSPACE_ARCHIVED,
        expect.objectContaining({ workspaceId: "workspace-1", reason: "Abandoned test account" }),
      );
    });

    it("rejects archiving an already-archived workspace", async () => {
      workspaceRepository.findById.mockResolvedValue(
        fakeWorkspace({ status: WorkspaceStatus.ARCHIVED }),
      );

      await expect(service.archive("workspace-1", "reason", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
