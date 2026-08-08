import { Test } from "@nestjs/testing";
import { PlatformSearchService } from "./platform-search.service.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";

describe("PlatformSearchService", () => {
  let service: PlatformSearchService;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let userRepository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformSearchService,
        { provide: WorkspaceRepository, useValue: { listAllForPlatform: jest.fn() } },
        { provide: UserRepository, useValue: { searchAcrossWorkspaces: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformSearchService);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    userRepository = moduleRef.get(UserRepository);
  });

  it("searches both Workspace and User in parallel, scoped to Workspace + User only (§4.6 Question 3)", async () => {
    workspaceRepository.listAllForPlatform.mockResolvedValue({
      items: [
        {
          _id: { toString: () => "workspace-1" },
          name: "Acme Retail",
          ownerId: { toString: () => "owner-1" },
          status: "ACTIVE",
          statusReason: null,
          statusChangedAt: null,
          statusChangedBy: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        } as never,
      ],
      total: 1,
    });
    userRepository.searchAcrossWorkspaces.mockResolvedValue([
      {
        _id: { toString: () => "user-1" },
        fullName: "Jane Doe",
        email: "jane@acme.test",
        workspaceId: "workspace-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      } as never,
    ]);

    const result = await service.search("acme");

    expect(workspaceRepository.listAllForPlatform).toHaveBeenCalledWith({ q: "acme" }, 1, 20);
    expect(userRepository.searchAcrossWorkspaces).toHaveBeenCalledWith("acme", 20);
    expect(result.workspaces).toEqual([expect.objectContaining({ id: "workspace-1" })]);
    expect(result.users).toEqual([
      expect.objectContaining({ id: "user-1", email: "jane@acme.test" }),
    ]);
  });
});
