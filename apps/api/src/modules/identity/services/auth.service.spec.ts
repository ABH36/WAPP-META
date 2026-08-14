import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { WorkspaceMemberStatus } from "@wapp/shared-types";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { UserRepository } from "../repositories/user.repository.js";
import { AuthTokenRepository } from "../repositories/auth-token.repository.js";
import { SessionRepository } from "../repositories/session.repository.js";
import { LoginHistoryRepository } from "../repositories/login-history.repository.js";
import { WorkspaceMaintenanceStateRepository } from "../repositories/workspace-maintenance-state.repository.js";
import { PlatformMaintenanceGateRepository } from "../repositories/platform-maintenance-gate.repository.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";
import { EmailService } from "../../../infrastructure/email/email.service.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";
import type { UserDocument } from "../schemas/user.schema.js";
import type { SessionDocument } from "../schemas/session.schema.js";

function fakeUser(overrides: Partial<Record<string, unknown>> = {}): UserDocument {
  const base = {
    _id: { toString: () => "user-1" },
    fullName: "Jane Owner",
    email: "jane@example.com",
    mobileNumber: "+919876543210",
    passwordHash: "hashed-password",
    workspaceId: null,
    role: null,
    workspaceMemberStatus: null,
    isEmailVerified: true,
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    previousPasswordHashes: [] as string[],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
  return base as unknown as UserDocument;
}

function fakeSession(overrides: Partial<Record<string, unknown>> = {}): SessionDocument {
  const base = {
    _id: { toString: () => "session-1" },
    userId: { toString: () => "user-1" },
    jti: "jti-1",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    userAgent: null,
    ipAddress: null,
    createdAt: new Date(),
    ...overrides,
  };
  return base as unknown as SessionDocument;
}

describe("AuthService", () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let authTokenRepository: jest.Mocked<AuthTokenRepository>;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let loginHistoryRepository: jest.Mocked<LoginHistoryRepository>;
  let maintenanceStateRepository: jest.Mocked<WorkspaceMaintenanceStateRepository>;
  let platformMaintenanceGateRepository: jest.Mocked<PlatformMaintenanceGateRepository>;
  let passwordService: jest.Mocked<PasswordService>;
  let tokenService: jest.Mocked<TokenService>;
  let emailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: {
            findByEmail: jest.fn(),
            findByMobileNumber: jest.fn(),
            create: jest.fn(),
            markEmailVerified: jest.fn(),
            updatePasswordHash: jest.fn(),
            recordSuccessfulLogin: jest.fn(),
            registerFailedLogin: jest.fn(),
            findById: jest.fn(),
            findByIdWithPasswordHistory: jest.fn(),
            updatePasswordAndHistory: jest.fn(),
            findWorkspaceMembers: jest.fn(),
          },
        },
        {
          provide: AuthTokenRepository,
          useValue: {
            create: jest.fn(),
            findValidByHash: jest.fn(),
            markUsed: jest.fn(),
            invalidatePendingForUser: jest.fn(),
          },
        },
        {
          provide: SessionRepository,
          useValue: {
            create: jest.fn(),
            findByJti: jest.fn(),
            findActiveByUser: jest.fn(),
            revokeByJti: jest.fn(),
            revokeAllForUser: jest.fn(),
            revokeByIdForUser: jest.fn(),
          },
        },
        {
          provide: LoginHistoryRepository,
          useValue: {
            record: jest.fn(),
            findRecentByUser: jest.fn(),
            findByUsers: jest.fn(),
            deleteOlderThan: jest.fn(),
          },
        },
        {
          provide: WorkspaceMaintenanceStateRepository,
          useValue: {
            isMaintenanceMode: jest.fn(),
            setMaintenanceMode: jest.fn(),
            isLoginBlocked: jest.fn(),
            setLoginBlocked: jest.fn(),
          },
        },
        {
          provide: PlatformMaintenanceGateRepository,
          useValue: { isEnabled: jest.fn(), setEnabled: jest.fn() },
        },
        {
          provide: PasswordService,
          useValue: { hash: jest.fn(), compare: jest.fn() },
        },
        {
          provide: TokenService,
          useValue: {
            signAccessToken: jest.fn(),
            signRefreshToken: jest.fn(),
            verifyRefreshToken: jest.fn(),
            generateOpaqueToken: jest.fn(),
            hashOpaqueToken: jest.fn(),
          },
        },
        { provide: EmailService, useValue: { send: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "auth") {
                return {
                  bcryptSaltRounds: 4,
                  emailVerificationTokenTtlMinutes: 60,
                  passwordResetTokenTtlMinutes: 30,
                  maxFailedLoginAttempts: 5,
                  accountLockoutMinutes: 15,
                  passwordHistoryLimit: 5,
                };
              }
              if (key === "urls") {
                return { web: "http://localhost:3000", admin: "http://localhost:3001" };
              }
              throw new Error(`Unexpected config key: ${key}`);
            },
          },
        },
        MetricsService,
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    userRepository = moduleRef.get(UserRepository);
    authTokenRepository = moduleRef.get(AuthTokenRepository);
    sessionRepository = moduleRef.get(SessionRepository);
    loginHistoryRepository = moduleRef.get(LoginHistoryRepository);
    maintenanceStateRepository = moduleRef.get(WorkspaceMaintenanceStateRepository);
    platformMaintenanceGateRepository = moduleRef.get(PlatformMaintenanceGateRepository);
    passwordService = moduleRef.get(PasswordService);
    tokenService = moduleRef.get(TokenService);
    emailService = moduleRef.get(EmailService);

    // Sensible defaults shared by most tests.
    tokenService.generateOpaqueToken.mockReturnValue("raw-opaque-token");
    maintenanceStateRepository.isMaintenanceMode.mockResolvedValue(false);
    maintenanceStateRepository.isLoginBlocked.mockResolvedValue(false);
    platformMaintenanceGateRepository.isEnabled.mockResolvedValue(false);
    tokenService.hashOpaqueToken.mockReturnValue("hashed-opaque-token");
    tokenService.signAccessToken.mockReturnValue({ token: "access-token", expiresIn: 900 });
    tokenService.signRefreshToken.mockReturnValue({
      token: "refresh-token",
      jti: "new-jti",
      expiresAt: new Date(Date.now() + 60_000),
    });
    sessionRepository.create.mockResolvedValue(fakeSession());
  });

  describe("register", () => {
    it("creates the user and sends a verification email on success", async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByMobileNumber.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue("hashed-password");
      userRepository.create.mockResolvedValue(fakeUser());

      const result = await service.register({
        fullName: "Jane Owner",
        email: "jane@example.com",
        mobileNumber: "+919876543210",
        password: "Passw0rd",
      });

      expect(result).toEqual({ email: "jane@example.com" });
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: "jane@example.com", passwordHash: "hashed-password" }),
      );
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: "jane@example.com", category: "email-verification" }),
      );
    });

    it("rejects a duplicate email", async () => {
      userRepository.findByEmail.mockResolvedValue(fakeUser());
      userRepository.findByMobileNumber.mockResolvedValue(null);

      await expect(
        service.register({
          fullName: "Jane Owner",
          email: "jane@example.com",
          mobileNumber: "+919876543210",
          password: "Passw0rd",
        }),
      ).rejects.toThrow(ConflictException);
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it("rejects a duplicate mobile number", async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByMobileNumber.mockResolvedValue(fakeUser());

      await expect(
        service.register({
          fullName: "Jane Owner",
          email: "new@example.com",
          mobileNumber: "+919876543210",
          password: "Passw0rd",
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("login", () => {
    it("issues tokens on success and resets the failure counter", async () => {
      userRepository.findByEmail.mockResolvedValue(fakeUser());
      passwordService.compare.mockResolvedValue(true);

      const result = await service.login(
        { email: "jane@example.com", password: "Passw0rd" },
        { userAgent: "jest", ipAddress: "127.0.0.1" },
      );

      expect(result.tokens.accessToken).toBe("access-token");
      expect(userRepository.recordSuccessfulLogin).toHaveBeenCalledWith("user-1");
      expect(loginHistoryRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", success: true, reason: null }),
      );
    });

    it("rejects an unknown email without revealing that it doesn't exist", async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.login(
          { email: "nobody@example.com", password: "x" },
          {
            userAgent: null,
            ipAddress: null,
          },
        ),
      ).rejects.toThrow(UnauthorizedException);
      // Timing-attack mitigation — still runs a bcrypt compare.
      expect(passwordService.compare).toHaveBeenCalled();
    });

    it("locks out and rejects after too many failed attempts", async () => {
      userRepository.findByEmail.mockResolvedValue(
        fakeUser({ lockedUntil: new Date(Date.now() + 60_000) }),
      );

      await expect(
        service.login(
          { email: "jane@example.com", password: "wrong" },
          {
            userAgent: null,
            ipAddress: null,
          },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(passwordService.compare).not.toHaveBeenCalled();
    });

    it("registers a failed attempt on wrong password", async () => {
      userRepository.findByEmail.mockResolvedValue(fakeUser());
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.login(
          { email: "jane@example.com", password: "wrong" },
          {
            userAgent: null,
            ipAddress: null,
          },
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(userRepository.registerFailedLogin).toHaveBeenCalledWith("user-1", 5, 15);
      expect(loginHistoryRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          success: false,
          reason: "INVALID_CREDENTIALS",
        }),
      );
    });

    it("blocks login for an unverified account (LOGIN-BR-001)", async () => {
      userRepository.findByEmail.mockResolvedValue(fakeUser({ isEmailVerified: false }));
      passwordService.compare.mockResolvedValue(true);

      await expect(
        service.login(
          { email: "jane@example.com", password: "Passw0rd" },
          {
            userAgent: null,
            ipAddress: null,
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("blocks login for a disabled account", async () => {
      userRepository.findByEmail.mockResolvedValue(fakeUser({ isActive: false }));
      passwordService.compare.mockResolvedValue(true);

      await expect(
        service.login(
          { email: "jane@example.com", password: "Passw0rd" },
          {
            userAgent: null,
            ipAddress: null,
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("blocks login for a suspended workspace member", async () => {
      userRepository.findByEmail.mockResolvedValue(
        fakeUser({ workspaceMemberStatus: WorkspaceMemberStatus.SUSPENDED }),
      );
      passwordService.compare.mockResolvedValue(true);

      await expect(
        service.login(
          { email: "jane@example.com", password: "Passw0rd" },
          {
            userAgent: null,
            ipAddress: null,
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("blocks login for a removed workspace member", async () => {
      userRepository.findByEmail.mockResolvedValue(
        fakeUser({ workspaceMemberStatus: WorkspaceMemberStatus.REMOVED }),
      );
      passwordService.compare.mockResolvedValue(true);

      await expect(
        service.login(
          { email: "jane@example.com", password: "Passw0rd" },
          {
            userAgent: null,
            ipAddress: null,
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("verifyEmail", () => {
    it("marks the account verified and auto-issues tokens", async () => {
      authTokenRepository.findValidByHash.mockResolvedValue({
        _id: { toString: () => "token-1" },
        userId: { toString: () => "user-1" },
      } as never);
      userRepository.findById.mockResolvedValue(fakeUser({ isEmailVerified: true }));

      const result = await service.verifyEmail("raw-token");

      expect(authTokenRepository.markUsed).toHaveBeenCalledWith("token-1");
      expect(userRepository.markEmailVerified).toHaveBeenCalledWith("user-1");
      expect(result.tokens.accessToken).toBe("access-token");
    });

    it("rejects an invalid or expired token", async () => {
      authTokenRepository.findValidByHash.mockResolvedValue(null);
      await expect(service.verifyEmail("bad-token")).rejects.toThrow(BadRequestException);
    });
  });

  describe("refresh", () => {
    it("rotates the session and issues a new token pair", async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: "user-1",
        jti: "old-jti",
        type: "refresh",
      });
      sessionRepository.findByJti.mockResolvedValue(fakeSession({ jti: "old-jti" }));
      userRepository.findById.mockResolvedValue(fakeUser());

      const result = await service.refresh("some-refresh-token", {
        userAgent: null,
        ipAddress: null,
      });

      expect(result.accessToken).toBe("access-token");
      expect(sessionRepository.revokeByJti).toHaveBeenCalledWith("old-jti", "new-jti");
    });

    it("revokes every session for the user on reuse of a revoked token", async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: "user-1",
        jti: "stolen-jti",
        type: "refresh",
      });
      sessionRepository.findByJti.mockResolvedValue(
        fakeSession({ jti: "stolen-jti", revokedAt: new Date() }),
      );

      await expect(
        service.refresh("stolen-token", { userAgent: null, ipAddress: null }),
      ).rejects.toThrow(UnauthorizedException);
      expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith("user-1");
    });

    it("rejects when the session no longer exists", async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: "user-1",
        jti: "missing-jti",
        type: "refresh",
      });
      sessionRepository.findByJti.mockResolvedValue(null);

      await expect(service.refresh("token", { userAgent: null, ipAddress: null })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("rejects refresh for a suspended workspace member", async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: "user-1",
        jti: "some-jti",
        type: "refresh",
      });
      sessionRepository.findByJti.mockResolvedValue(fakeSession({ jti: "some-jti" }));
      userRepository.findById.mockResolvedValue(
        fakeUser({ workspaceMemberStatus: WorkspaceMemberStatus.SUSPENDED }),
      );

      await expect(service.refresh("token", { userAgent: null, ipAddress: null })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("reissueTokens", () => {
    it("issues a fresh token pair for the given user", async () => {
      userRepository.findById.mockResolvedValue(fakeUser());

      const result = await service.reissueTokens("user-1", { userAgent: null, ipAddress: null });

      expect(result.accessToken).toBe("access-token");
      expect(sessionRepository.create).toHaveBeenCalled();
    });

    it("throws when the user no longer exists", async () => {
      userRepository.findById.mockResolvedValue(null);
      await expect(
        service.reissueTokens("ghost", { userAgent: null, ipAddress: null }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("forgotPassword / resetPassword", () => {
    it("silently no-ops for an unknown email", async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      await service.forgotPassword({ email: "nobody@example.com" });
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it("sends a reset email for a known account", async () => {
      userRepository.findByEmail.mockResolvedValue(fakeUser());
      await service.forgotPassword({ email: "jane@example.com" });
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: "jane@example.com", category: "password-reset" }),
      );
    });

    it("rejects an invalid reset token", async () => {
      authTokenRepository.findValidByHash.mockResolvedValue(null);
      await expect(
        service.resetPassword({ token: "bad", newPassword: "NewPassw0rd" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("updates the password and revokes all sessions on success", async () => {
      authTokenRepository.findValidByHash.mockResolvedValue({
        _id: { toString: () => "token-1" },
        userId: { toString: () => "user-1" },
      } as never);
      passwordService.hash.mockResolvedValue("new-hashed-password");

      await service.resetPassword({ token: "good", newPassword: "NewPassw0rd" });

      expect(userRepository.updatePasswordHash).toHaveBeenCalledWith(
        "user-1",
        "new-hashed-password",
      );
      expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith("user-1");
    });
  });

  describe("session management", () => {
    it("lists active sessions for the current user", async () => {
      sessionRepository.findActiveByUser.mockResolvedValue([fakeSession()]);
      const result = await service.listSessions("user-1");
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("session-1");
    });

    it("throws when revoking a session that doesn't belong to the user", async () => {
      sessionRepository.revokeByIdForUser.mockResolvedValue(false);
      await expect(service.revokeSession("user-1", "not-mine")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("does not throw when logging out with an already-invalid token", async () => {
      tokenService.verifyRefreshToken.mockImplementation(() => {
        throw new UnauthorizedException();
      });
      await expect(service.logout("garbage")).resolves.toBeUndefined();
    });
  });

  describe("changePassword", () => {
    it("rejects the wrong current password without touching history or sessions", async () => {
      userRepository.findByIdWithPasswordHistory.mockResolvedValue(fakeUser());
      passwordService.compare.mockResolvedValue(false);

      await expect(service.changePassword("user-1", "wrong", "NewPassw0rd")).rejects.toThrow(
        BadRequestException,
      );
      expect(userRepository.updatePasswordAndHistory).not.toHaveBeenCalled();
      expect(sessionRepository.revokeAllForUser).not.toHaveBeenCalled();
    });

    it("rejects reuse of the current password or a historical one", async () => {
      userRepository.findByIdWithPasswordHistory.mockResolvedValue(
        fakeUser({ previousPasswordHashes: ["old-hash-1", "old-hash-2"] }),
      );
      // First compare (against current passwordHash) is the "is this really your current password" check and must succeed;
      // the loop that follows re-compares the *new* password against passwordHash + history — make the first of those match too.
      passwordService.compare.mockResolvedValue(true);

      await expect(
        service.changePassword("user-1", "CurrentPassw0rd", "ReusedPassw0rd"),
      ).rejects.toThrow(BadRequestException);
      expect(userRepository.updatePasswordAndHistory).not.toHaveBeenCalled();
    });

    it("updates the password, prepends the old hash to history, and revokes every session", async () => {
      userRepository.findByIdWithPasswordHistory.mockResolvedValue(
        fakeUser({ passwordHash: "current-hash", previousPasswordHashes: ["old-hash-1"] }),
      );
      passwordService.compare
        .mockResolvedValueOnce(true) // current password matches
        .mockResolvedValueOnce(false) // new password vs current hash
        .mockResolvedValueOnce(false); // new password vs old-hash-1
      passwordService.hash.mockResolvedValue("new-hash");

      await service.changePassword("user-1", "CurrentPassw0rd", "NewPassw0rd1");

      expect(userRepository.updatePasswordAndHistory).toHaveBeenCalledWith("user-1", "new-hash", [
        "current-hash",
        "old-hash-1",
      ]);
      expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith("user-1");
    });
  });

  describe("getLoginHistory", () => {
    it("maps recent entries for the given user", async () => {
      loginHistoryRepository.findRecentByUser.mockResolvedValue([
        {
          _id: { toString: () => "entry-1" },
          userId: { toString: () => "user-1" },
          success: true,
          reason: null,
          ipAddress: "127.0.0.1",
          userAgent: "jest",
          createdAt: new Date("2026-08-07T00:00:00.000Z"),
        } as never,
      ]);

      const result = await service.getLoginHistory("user-1");

      expect(loginHistoryRepository.findRecentByUser).toHaveBeenCalledWith("user-1");
      expect(result).toEqual([
        {
          id: "entry-1",
          userId: "user-1",
          success: true,
          reason: null,
          ipAddress: "127.0.0.1",
          userAgent: "jest",
          createdAt: "2026-08-07T00:00:00.000Z",
        },
      ]);
    });
  });

  describe("getWorkspaceLoginHistory", () => {
    it("resolves workspace member ids first, then queries login history across all of them", async () => {
      userRepository.findWorkspaceMembers.mockResolvedValue([
        fakeUser({ _id: { toString: () => "user-1" } }),
        fakeUser({ _id: { toString: () => "user-2" } }),
      ]);
      loginHistoryRepository.findByUsers.mockResolvedValue([
        {
          _id: { toString: () => "entry-1" },
          userId: { toString: () => "user-1" },
          success: true,
          reason: null,
          ipAddress: null,
          userAgent: null,
          createdAt: new Date("2026-08-08T00:00:00.000Z"),
        } as never,
      ]);

      const result = await service.getWorkspaceLoginHistory("workspace-1");

      expect(userRepository.findWorkspaceMembers).toHaveBeenCalledWith("workspace-1");
      expect(loginHistoryRepository.findByUsers).toHaveBeenCalledWith(["user-1", "user-2"]);
      expect(result).toHaveLength(1);
      expect(result[0]?.userId).toBe("user-1");
    });

    it("returns an empty array without querying login history when the workspace has no members", async () => {
      userRepository.findWorkspaceMembers.mockResolvedValue([]);

      const result = await service.getWorkspaceLoginHistory("workspace-1");

      expect(loginHistoryRepository.findByUsers).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("cleanupLoginHistory", () => {
    it("deletes login history older than the cutoff for every workspace member", async () => {
      userRepository.findWorkspaceMembers.mockResolvedValue([
        fakeUser({ _id: { toString: () => "user-1" } }),
      ]);
      loginHistoryRepository.deleteOlderThan.mockResolvedValue(3);

      const cutoff = new Date("2026-01-01T00:00:00.000Z");
      const result = await service.cleanupLoginHistory("workspace-1", cutoff);

      expect(loginHistoryRepository.deleteOlderThan).toHaveBeenCalledWith(["user-1"], cutoff);
      expect(result).toBe(3);
    });
  });

  describe("login — maintenance mode (PRD-006 Volume-4 §4.6)", () => {
    it("blocks a new login when the user's workspace is in maintenance mode", async () => {
      userRepository.findByEmail.mockResolvedValue(fakeUser({ workspaceId: "workspace-1" }));
      passwordService.compare.mockResolvedValue(true);
      maintenanceStateRepository.isMaintenanceMode.mockResolvedValue(true);

      await expect(
        service.login(
          { email: "jane@example.com", password: "Passw0rd1" },
          { userAgent: null, ipAddress: null },
        ),
      ).rejects.toThrow("maintenance");
      expect(userRepository.recordSuccessfulLogin).not.toHaveBeenCalled();
    });

    it("does not check maintenance mode for a user with no workspace yet", async () => {
      userRepository.findByEmail.mockResolvedValue(fakeUser({ workspaceId: null }));
      passwordService.compare.mockResolvedValue(true);
      tokenService.signRefreshToken.mockReturnValue({
        token: "refresh-token",
        jti: "jti-1",
        expiresAt: new Date(Date.now() + 60_000),
      });
      tokenService.signAccessToken.mockReturnValue({ token: "access-token", expiresIn: 900 });

      await service.login(
        { email: "jane@example.com", password: "Passw0rd1" },
        { userAgent: null, ipAddress: null },
      );

      expect(maintenanceStateRepository.isMaintenanceMode).not.toHaveBeenCalled();
    });
  });

  describe("login — workspace suspended/archived (PRD-007 Volume-1 §4.1)", () => {
    it("blocks a new login when the user's workspace has been suspended or archived", async () => {
      userRepository.findByEmail.mockResolvedValue(fakeUser({ workspaceId: "workspace-1" }));
      passwordService.compare.mockResolvedValue(true);
      maintenanceStateRepository.isLoginBlocked.mockResolvedValue(true);

      await expect(
        service.login(
          { email: "jane@example.com", password: "Passw0rd1" },
          { userAgent: null, ipAddress: null },
        ),
      ).rejects.toThrow("suspended");
      expect(loginHistoryRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, reason: "WORKSPACE_SUSPENDED_OR_ARCHIVED" }),
      );
      expect(userRepository.recordSuccessfulLogin).not.toHaveBeenCalled();
    });

    it("does not check the login-blocked gate for a user with no workspace yet", async () => {
      userRepository.findByEmail.mockResolvedValue(fakeUser({ workspaceId: null }));
      passwordService.compare.mockResolvedValue(true);

      await service.login(
        { email: "jane@example.com", password: "Passw0rd1" },
        { userAgent: null, ipAddress: null },
      );

      expect(maintenanceStateRepository.isLoginBlocked).not.toHaveBeenCalled();
    });
  });

  describe("login — platform-wide maintenance (PRD-007 Volume-1 §4.7)", () => {
    it("blocks a new login for any workspace when platform-wide maintenance is enabled", async () => {
      userRepository.findByEmail.mockResolvedValue(fakeUser({ workspaceId: "workspace-1" }));
      passwordService.compare.mockResolvedValue(true);
      platformMaintenanceGateRepository.isEnabled.mockResolvedValue(true);

      await expect(
        service.login(
          { email: "jane@example.com", password: "Passw0rd1" },
          { userAgent: null, ipAddress: null },
        ),
      ).rejects.toThrow("platform");
      expect(loginHistoryRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, reason: "PLATFORM_MAINTENANCE_MODE" }),
      );
      // The platform-wide gate short-circuits before any per-workspace check runs.
      expect(maintenanceStateRepository.isLoginBlocked).not.toHaveBeenCalled();
    });

    it("checks the platform-wide gate even for a user with no workspace yet", async () => {
      userRepository.findByEmail.mockResolvedValue(fakeUser({ workspaceId: null }));
      passwordService.compare.mockResolvedValue(true);
      platformMaintenanceGateRepository.isEnabled.mockResolvedValue(true);

      await expect(
        service.login(
          { email: "jane@example.com", password: "Passw0rd1" },
          { userAgent: null, ipAddress: null },
        ),
      ).rejects.toThrow("platform");
    });
  });
});
