import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { TenantRole, WorkspaceMemberStatus, WorkspaceStatus } from "@wapp/shared-types";
import { WorkspaceService } from "./workspace.service.js";
import { WorkspaceRepository } from "../repositories/workspace.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { AuthService } from "../../identity/services/auth.service.js";
import type { WorkspaceDocument } from "../schemas/workspace.schema.js";
import type { UserDocument } from "../../identity/schemas/user.schema.js";

function fakeWorkspace(overrides: Partial<Record<string, unknown>> = {}): WorkspaceDocument {
  const base = {
    _id: { toString: () => "workspace-1" },
    name: "Acme Trading Co",
    ownerId: { toString: () => "user-1" },
    businessProfile: { category: null, description: null, gstin: null },
    businessHours: { timezone: "Asia/Kolkata", schedule: [], publicHolidays: [] },
    notificationSettings: {
      taskFollowUpReminder: true,
      conversationLeadAssignment: true,
      broadcastCompleted: true,
      subscriptionReminder: true,
    },
    language: "en",
    status: WorkspaceStatus.TRIAL,
    trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
  return base as unknown as WorkspaceDocument;
}

function fakeUser(overrides: Partial<Record<string, unknown>> = {}): UserDocument {
  const base = {
    _id: { toString: () => "user-1" },
    email: "jane@example.com",
    workspaceId: null,
    role: null,
    workspaceMemberStatus: null,
    ...overrides,
  };
  return base as unknown as UserDocument;
}

describe("WorkspaceService", () => {
  let service: WorkspaceService;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let authService: jest.Mocked<AuthService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        {
          provide: WorkspaceRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            updateBusinessProfile: jest.fn(),
            updateBusinessHours: jest.fn(),
            updateNotificationSettings: jest.fn(),
            updateStatus: jest.fn(),
            updateOwner: jest.fn(),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            assignWorkspaceMembership: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: { reissueTokens: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "workspace") {
                return { trialDurationDays: 14, invitationTokenTtlDays: 7 };
              }
              throw new Error(`Unexpected config key: ${key}`);
            },
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(WorkspaceService);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    userRepository = moduleRef.get(UserRepository);
    authService = moduleRef.get(AuthService);
    eventEmitter = moduleRef.get(EventEmitter2);

    workspaceRepository.findById.mockResolvedValue(fakeWorkspace());
    authService.reissueTokens.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
    });
  });

  describe("create", () => {
    it("creates a workspace, makes the creator OWNER/ACTIVE, and reissues tokens", async () => {
      userRepository.findById.mockResolvedValue(fakeUser());
      workspaceRepository.create.mockResolvedValue(fakeWorkspace());

      const result = await service.create(
        "user-1",
        { name: "Acme Trading Co" },
        { userAgent: null, ipAddress: null },
      );

      expect(workspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Acme Trading Co", ownerId: "user-1" }),
      );
      expect(userRepository.assignWorkspaceMembership).toHaveBeenCalledWith(
        "user-1",
        "workspace-1",
        TenantRole.OWNER,
        WorkspaceMemberStatus.ACTIVE,
      );
      expect(result.tokens.accessToken).toBe("access-token");
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "workspace.created",
        expect.objectContaining({ workspaceId: "workspace-1", ownerId: "user-1" }),
      );
    });

    it("rejects when the user doesn't exist", async () => {
      userRepository.findById.mockResolvedValue(null);
      await expect(
        service.create("ghost", { name: "X" }, { userAgent: null, ipAddress: null }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects when the user already belongs to a workspace", async () => {
      userRepository.findById.mockResolvedValue(fakeUser({ workspaceId: "existing-workspace" }));
      await expect(
        service.create("user-1", { name: "X" }, { userAgent: null, ipAddress: null }),
      ).rejects.toThrow(ConflictException);
      expect(workspaceRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("throws when the workspace doesn't exist", async () => {
      workspaceRepository.findById.mockResolvedValue(null);
      await expect(service.getById("missing")).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateBusinessHours", () => {
    it("rejects a schedule with duplicate dayOfWeek entries", async () => {
      await expect(
        service.updateBusinessHours(
          "workspace-1",
          {
            schedule: [
              { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "18:00" },
              { dayOfWeek: 1, isOpen: true, openTime: "10:00", closeTime: "19:00" },
            ],
          },
          "user-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(workspaceRepository.updateBusinessHours).not.toHaveBeenCalled();
    });

    it("accepts a schedule with unique dayOfWeek entries", async () => {
      await service.updateBusinessHours(
        "workspace-1",
        {
          schedule: [
            { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "18:00" },
            { dayOfWeek: 2, isOpen: true, openTime: "09:00", closeTime: "18:00" },
          ],
        },
        "user-1",
      );
      expect(workspaceRepository.updateBusinessHours).toHaveBeenCalled();
    });
  });
});
