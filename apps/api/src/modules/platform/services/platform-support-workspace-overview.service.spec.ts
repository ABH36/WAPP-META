import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { PlatformSupportWorkspaceOverviewService } from "./platform-support-workspace-overview.service.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { SubscriptionService } from "../../billing/services/subscription.service.js";
import { InvoiceService } from "../../billing/services/invoice.service.js";
import { SettingsService } from "../../settings/services/settings.service.js";
import { WorkspaceStatus, TenantRole, WorkspaceMemberStatus } from "@wapp/shared-types";

const fakeWorkspace = {
  _id: { toString: () => "workspace-1" },
  name: "Acme Retail",
  ownerId: { toString: () => "owner-1" },
  status: WorkspaceStatus.ACTIVE,
  statusReason: null,
  statusChangedAt: null,
  statusChangedBy: null,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
};

const fakeMember = {
  _id: { toString: () => "user-1" },
  fullName: "Jane Owner",
  email: "jane@example.com",
  mobileNumber: "+919876543210",
  role: TenantRole.OWNER,
  workspaceMemberStatus: WorkspaceMemberStatus.ACTIVE,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
};

describe("PlatformSupportWorkspaceOverviewService", () => {
  let service: PlatformSupportWorkspaceOverviewService;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let subscriptionService: jest.Mocked<SubscriptionService>;
  let invoiceService: jest.Mocked<InvoiceService>;
  let settingsService: jest.Mocked<SettingsService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformSupportWorkspaceOverviewService,
        { provide: WorkspaceRepository, useValue: { findById: jest.fn() } },
        { provide: UserRepository, useValue: { findWorkspaceMembers: jest.fn() } },
        { provide: SubscriptionService, useValue: { getForWorkspace: jest.fn() } },
        { provide: InvoiceService, useValue: { list: jest.fn() } },
        { provide: SettingsService, useValue: { getOverview: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformSupportWorkspaceOverviewService);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    userRepository = moduleRef.get(UserRepository);
    subscriptionService = moduleRef.get(SubscriptionService);
    invoiceService = moduleRef.get(InvoiceService);
    settingsService = moduleRef.get(SettingsService);
  });

  it("composes Workspace/Users/Subscription/Invoices/Settings into one overview", async () => {
    workspaceRepository.findById.mockResolvedValue(fakeWorkspace as never);
    userRepository.findWorkspaceMembers.mockResolvedValue([fakeMember as never]);
    subscriptionService.getForWorkspace.mockResolvedValue({ id: "subscription-1" } as never);
    invoiceService.list.mockResolvedValue([{ id: "invoice-1" } as never]);
    settingsService.getOverview.mockResolvedValue({ workspaceId: "workspace-1" } as never);

    const result = await service.getOverview("workspace-1");

    expect(result.workspace.id).toBe("workspace-1");
    expect(result.users).toHaveLength(1);
    expect(result.users[0]?.email).toBe("jane@example.com");
    expect(result.subscription).toEqual({ id: "subscription-1" });
    expect(result.invoices).toEqual([{ id: "invoice-1" }]);
    expect(result.settingsOverview).toEqual({ workspaceId: "workspace-1" });
  });

  it("throws NotFoundException for a missing workspace", async () => {
    workspaceRepository.findById.mockResolvedValue(null);

    await expect(service.getOverview("missing")).rejects.toThrow(NotFoundException);
    expect(userRepository.findWorkspaceMembers).not.toHaveBeenCalled();
  });
});
