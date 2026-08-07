import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { TenantRole, WorkspaceMemberStatus, WorkspaceStatus } from "@wapp/shared-types";
import { TeamService } from "./team.service.js";
import { WorkspaceRepository } from "../repositories/workspace.repository.js";
import { WorkspaceInvitationRepository } from "../repositories/workspace-invitation.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { TokenService } from "../../identity/services/token.service.js";
import { AuthService } from "../../identity/services/auth.service.js";
import { EmailService } from "../../../infrastructure/email/email.service.js";
import { PersistedInvitationStatus } from "../schemas/workspace-invitation.schema.js";
import type { WorkspaceDocument } from "../schemas/workspace.schema.js";
import type { WorkspaceInvitationDocument } from "../schemas/workspace-invitation.schema.js";
import type { UserDocument } from "../../identity/schemas/user.schema.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";

function fakeWorkspace(overrides: Partial<Record<string, unknown>> = {}): WorkspaceDocument {
  return {
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
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as unknown as WorkspaceDocument;
}

function fakeUser(overrides: Partial<Record<string, unknown>> = {}): UserDocument {
  return {
    _id: { toString: () => "user-2" },
    email: "invitee@example.com",
    workspaceId: null,
    role: null,
    workspaceMemberStatus: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as unknown as UserDocument;
}

function fakeInvitation(
  overrides: Partial<Record<string, unknown>> = {},
): WorkspaceInvitationDocument {
  return {
    _id: { toString: () => "invitation-1" },
    workspaceId: { toString: () => "workspace-1" },
    email: "invitee@example.com",
    role: TenantRole.SALES_EXECUTIVE,
    invitedBy: { toString: () => "user-1" },
    tokenHash: "hashed-token",
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
    status: PersistedInvitationStatus.PENDING,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as unknown as WorkspaceInvitationDocument;
}

describe("TeamService", () => {
  let service: TeamService;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let invitationRepository: jest.Mocked<WorkspaceInvitationRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let tokenService: jest.Mocked<TokenService>;
  let authService: jest.Mocked<AuthService>;
  let emailService: jest.Mocked<EmailService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TeamService,
        {
          provide: WorkspaceRepository,
          useValue: { findById: jest.fn(), updateOwner: jest.fn() },
        },
        {
          provide: WorkspaceInvitationRepository,
          useValue: {
            create: jest.fn(),
            findPendingByHash: jest.fn(),
            findPendingByWorkspaceAndEmail: jest.fn(),
            findByWorkspace: jest.fn(),
            findByIdForWorkspace: jest.fn(),
            markAccepted: jest.fn(),
            markRevoked: jest.fn(),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            assignWorkspaceMembership: jest.fn(),
            updateWorkspaceRole: jest.fn(),
            updateWorkspaceMemberStatus: jest.fn(),
            findWorkspaceMembers: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: { generateOpaqueToken: jest.fn(), hashOpaqueToken: jest.fn() },
        },
        {
          provide: AuthService,
          useValue: { reissueTokens: jest.fn(), revokeAllSessions: jest.fn() },
        },
        { provide: EmailService, useValue: { send: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "workspace") {
                return { trialDurationDays: 14, invitationTokenTtlDays: 7 };
              }
              if (key === "urls") {
                return { web: "http://localhost:3000", admin: "http://localhost:3001" };
              }
              throw new Error(`Unexpected config key: ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(TeamService);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    invitationRepository = moduleRef.get(WorkspaceInvitationRepository);
    userRepository = moduleRef.get(UserRepository);
    tokenService = moduleRef.get(TokenService);
    authService = moduleRef.get(AuthService);
    emailService = moduleRef.get(EmailService);
    eventEmitter = moduleRef.get(EventEmitter2);

    workspaceRepository.findById.mockResolvedValue(fakeWorkspace());
    tokenService.generateOpaqueToken.mockReturnValue("raw-token");
    tokenService.hashOpaqueToken.mockReturnValue("hashed-token");
  });

  describe("inviteMember", () => {
    it("creates an invitation and sends an email", async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      invitationRepository.findPendingByWorkspaceAndEmail.mockResolvedValue(null);

      await service.inviteMember("workspace-1", "user-1", {
        email: "invitee@example.com",
        role: TenantRole.SALES_EXECUTIVE,
      });

      expect(invitationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: "workspace-1", email: "invitee@example.com" }),
      );
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: "invitee@example.com", category: "team-invitation" }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "team.member_invited",
        expect.objectContaining({ workspaceId: "workspace-1", email: "invitee@example.com" }),
      );
    });

    it("rejects inviting an email that already belongs to a workspace", async () => {
      userRepository.findByEmail.mockResolvedValue(
        fakeUser({ workspaceId: "some-other-workspace" }),
      );

      await expect(
        service.inviteMember("workspace-1", "user-1", {
          email: "invitee@example.com",
          role: TenantRole.SALES_EXECUTIVE,
        }),
      ).rejects.toThrow(ConflictException);
      expect(invitationRepository.create).not.toHaveBeenCalled();
    });

    it("revokes an existing pending invitation before creating a fresh one (resend)", async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      invitationRepository.findPendingByWorkspaceAndEmail.mockResolvedValue(fakeInvitation());

      await service.inviteMember("workspace-1", "user-1", {
        email: "invitee@example.com",
        role: TenantRole.SALES_EXECUTIVE,
      });

      expect(invitationRepository.markRevoked).toHaveBeenCalledWith("invitation-1");
      expect(invitationRepository.create).toHaveBeenCalled();
    });
  });

  describe("acceptInvitation", () => {
    const actingUser: AuthenticatedUser = {
      userId: "user-2",
      workspaceId: null,
      role: null,
      workspaceMemberStatus: null,
      emailVerified: true,
    };

    it("rejects an invalid/unknown token", async () => {
      invitationRepository.findPendingByHash.mockResolvedValue(null);
      await expect(
        service.acceptInvitation(actingUser, "bad-token", { userAgent: null, ipAddress: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects an expired invitation", async () => {
      invitationRepository.findPendingByHash.mockResolvedValue(
        fakeInvitation({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(
        service.acceptInvitation(actingUser, "raw-token", { userAgent: null, ipAddress: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects when the logged-in user's email doesn't match the invitation", async () => {
      invitationRepository.findPendingByHash.mockResolvedValue(fakeInvitation());
      userRepository.findById.mockResolvedValue(fakeUser({ email: "someone-else@example.com" }));

      await expect(
        service.acceptInvitation(actingUser, "raw-token", { userAgent: null, ipAddress: null }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects when the user already belongs to a workspace", async () => {
      invitationRepository.findPendingByHash.mockResolvedValue(fakeInvitation());
      userRepository.findById.mockResolvedValue(fakeUser({ workspaceId: "already-has-one" }));

      await expect(
        service.acceptInvitation(actingUser, "raw-token", { userAgent: null, ipAddress: null }),
      ).rejects.toThrow(ConflictException);
    });

    it("joins the workspace and reissues tokens on success", async () => {
      invitationRepository.findPendingByHash.mockResolvedValue(fakeInvitation());
      userRepository.findById.mockResolvedValue(fakeUser());
      authService.reissueTokens.mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: 900,
      });

      const result = await service.acceptInvitation(actingUser, "raw-token", {
        userAgent: null,
        ipAddress: null,
      });

      expect(userRepository.assignWorkspaceMembership).toHaveBeenCalledWith(
        "user-2",
        "workspace-1",
        TenantRole.SALES_EXECUTIVE,
        WorkspaceMemberStatus.ACTIVE,
      );
      expect(invitationRepository.markAccepted).toHaveBeenCalledWith("invitation-1");
      expect(result.tokens.accessToken).toBe("access-token");
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "team.member_accepted",
        expect.objectContaining({ workspaceId: "workspace-1", userId: "user-2" }),
      );
    });
  });

  describe("member lifecycle", () => {
    it("prevents changing the Owner's role", async () => {
      userRepository.findById.mockResolvedValue(
        fakeUser({ workspaceId: "workspace-1", role: TenantRole.OWNER }),
      );
      await expect(
        service.updateMemberRole("workspace-1", "user-2", { role: TenantRole.ADMINISTRATOR }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("prevents suspending the Owner", async () => {
      userRepository.findById.mockResolvedValue(
        fakeUser({ workspaceId: "workspace-1", role: TenantRole.OWNER }),
      );
      await expect(service.suspendMember("workspace-1", "user-2", "user-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("suspends a non-owner member, revokes their sessions, and emits the event", async () => {
      userRepository.findById.mockResolvedValue(
        fakeUser({ workspaceId: "workspace-1", role: TenantRole.SALES_EXECUTIVE }),
      );
      await service.suspendMember("workspace-1", "user-2", "user-1");
      expect(userRepository.updateWorkspaceMemberStatus).toHaveBeenCalledWith(
        "user-2",
        WorkspaceMemberStatus.SUSPENDED,
      );
      expect(authService.revokeAllSessions).toHaveBeenCalledWith("user-2");
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "team.member_suspended",
        expect.objectContaining({
          workspaceId: "workspace-1",
          userId: "user-2",
          actorId: "user-1",
        }),
      );
    });

    it("rejects reactivating a member who isn't currently suspended", async () => {
      userRepository.findById.mockResolvedValue(
        fakeUser({
          workspaceId: "workspace-1",
          role: TenantRole.SALES_EXECUTIVE,
          workspaceMemberStatus: WorkspaceMemberStatus.ACTIVE,
        }),
      );
      await expect(service.reactivateMember("workspace-1", "user-2", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("prevents removing the Owner", async () => {
      userRepository.findById.mockResolvedValue(
        fakeUser({ workspaceId: "workspace-1", role: TenantRole.OWNER }),
      );
      await expect(service.removeMember("workspace-1", "user-2")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("throws when the target isn't a member of this workspace", async () => {
      userRepository.findById.mockResolvedValue(fakeUser({ workspaceId: "different-workspace" }));
      await expect(service.suspendMember("workspace-1", "user-2", "user-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("transferOwnership", () => {
    it("rejects transferring to yourself", async () => {
      await expect(
        service.transferOwnership("workspace-1", "user-1", "user-1", {
          userAgent: null,
          ipAddress: null,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a target who isn't an active member", async () => {
      userRepository.findById.mockResolvedValue(
        fakeUser({
          workspaceId: "workspace-1",
          role: TenantRole.SALES_EXECUTIVE,
          workspaceMemberStatus: WorkspaceMemberStatus.SUSPENDED,
        }),
      );
      await expect(
        service.transferOwnership("workspace-1", "user-1", "user-2", {
          userAgent: null,
          ipAddress: null,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("promotes the target, demotes the current Owner, and reissues tokens", async () => {
      userRepository.findById.mockResolvedValue(
        fakeUser({
          workspaceId: "workspace-1",
          role: TenantRole.SALES_EXECUTIVE,
          workspaceMemberStatus: WorkspaceMemberStatus.ACTIVE,
        }),
      );
      authService.reissueTokens.mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: 900,
      });

      const result = await service.transferOwnership("workspace-1", "user-1", "user-2", {
        userAgent: null,
        ipAddress: null,
      });

      expect(userRepository.updateWorkspaceRole).toHaveBeenCalledWith("user-2", TenantRole.OWNER);
      expect(userRepository.updateWorkspaceRole).toHaveBeenCalledWith(
        "user-1",
        TenantRole.ADMINISTRATOR,
      );
      expect(workspaceRepository.updateOwner).toHaveBeenCalledWith("workspace-1", "user-2");
      expect(result.accessToken).toBe("access-token");
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "team.ownership_transferred",
        expect.objectContaining({
          workspaceId: "workspace-1",
          previousOwnerId: "user-1",
          newOwnerId: "user-2",
        }),
      );
    });
  });
});
