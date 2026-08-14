import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { PlatformRole } from "@wapp/shared-types";
import { PlatformAuthService } from "./platform-auth.service.js";
import { PlatformUserRepository } from "../repositories/platform-user.repository.js";
import { PlatformSessionRepository } from "../repositories/platform-session.repository.js";
import { PlatformLoginHistoryRepository } from "../repositories/platform-login-history.repository.js";
import { PlatformPasswordService } from "./platform-password.service.js";
import { PlatformTokenService } from "./platform-token.service.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";
import type { PlatformUserDocument } from "../schemas/platform-user.schema.js";
import type { PlatformSessionDocument } from "../schemas/platform-session.schema.js";

function fakePlatformUser(overrides: Partial<Record<string, unknown>> = {}): PlatformUserDocument {
  const base = {
    _id: { toString: () => "platform-user-1" },
    fullName: "Priya Admin",
    email: "priya@wapp.internal",
    passwordHash: "hashed-password",
    role: PlatformRole.PLATFORM_SUPER_ADMIN,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
  return base as unknown as PlatformUserDocument;
}

function fakePlatformSession(
  overrides: Partial<Record<string, unknown>> = {},
): PlatformSessionDocument {
  const base = {
    _id: { toString: () => "session-1" },
    platformUserId: { toString: () => "platform-user-1" },
    jti: "jti-1",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    userAgent: null,
    ipAddress: null,
    createdAt: new Date(),
    ...overrides,
  };
  return base as unknown as PlatformSessionDocument;
}

describe("PlatformAuthService", () => {
  let service: PlatformAuthService;
  let platformUserRepository: jest.Mocked<PlatformUserRepository>;
  let sessionRepository: jest.Mocked<PlatformSessionRepository>;
  let loginHistoryRepository: jest.Mocked<PlatformLoginHistoryRepository>;
  let passwordService: jest.Mocked<PlatformPasswordService>;
  let tokenService: jest.Mocked<PlatformTokenService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformAuthService,
        {
          provide: PlatformUserRepository,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            recordSuccessfulLogin: jest.fn(),
            registerFailedLogin: jest.fn(),
          },
        },
        {
          provide: PlatformSessionRepository,
          useValue: {
            create: jest.fn(),
            findByJti: jest.fn(),
            revokeByJti: jest.fn(),
            revokeAllForUser: jest.fn(),
          },
        },
        { provide: PlatformLoginHistoryRepository, useValue: { record: jest.fn() } },
        { provide: PlatformPasswordService, useValue: { hash: jest.fn(), compare: jest.fn() } },
        {
          provide: PlatformTokenService,
          useValue: {
            signAccessToken: jest.fn(),
            signRefreshToken: jest.fn(),
            verifyRefreshToken: jest.fn(),
            hashOpaqueToken: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "auth") {
                return { maxFailedLoginAttempts: 5, accountLockoutMinutes: 15 };
              }
              throw new Error(`Unexpected config key: ${key}`);
            },
          },
        },
        MetricsService,
      ],
    }).compile();

    service = moduleRef.get(PlatformAuthService);
    platformUserRepository = moduleRef.get(PlatformUserRepository);
    sessionRepository = moduleRef.get(PlatformSessionRepository);
    loginHistoryRepository = moduleRef.get(PlatformLoginHistoryRepository);
    passwordService = moduleRef.get(PlatformPasswordService);
    tokenService = moduleRef.get(PlatformTokenService);

    tokenService.hashOpaqueToken.mockReturnValue("hashed-opaque-token");
    tokenService.signAccessToken.mockReturnValue({ token: "access-token", expiresIn: 900 });
    tokenService.signRefreshToken.mockReturnValue({
      token: "refresh-token",
      jti: "new-jti",
      expiresAt: new Date(Date.now() + 60_000),
    });
    sessionRepository.create.mockResolvedValue(fakePlatformSession());
  });

  describe("login", () => {
    it("issues tokens on success and records the login", async () => {
      platformUserRepository.findByEmail.mockResolvedValue(fakePlatformUser());
      passwordService.compare.mockResolvedValue(true);

      const result = await service.login(
        "priya@wapp.internal",
        "Passw0rd1",
        { userAgent: "jest", ipAddress: "127.0.0.1" },
        false,
      );

      expect(result.tokens.accessToken).toBe("access-token");
      expect(result.user.email).toBe("priya@wapp.internal");
      expect(platformUserRepository.recordSuccessfulLogin).toHaveBeenCalledWith("platform-user-1");
      expect(loginHistoryRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ platformUserId: "platform-user-1", success: true, reason: null }),
      );
    });

    it("rejects an unknown email without revealing that it doesn't exist", async () => {
      platformUserRepository.findByEmail.mockResolvedValue(null);
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.login("nobody@wapp.internal", "x", { userAgent: null, ipAddress: null }, false),
      ).rejects.toThrow(UnauthorizedException);
      // Timing-attack mitigation — still runs a bcrypt compare against the dummy hash.
      expect(passwordService.compare).toHaveBeenCalled();
      expect(loginHistoryRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          platformUserId: null,
          email: "nobody@wapp.internal",
          success: false,
          reason: "INVALID_CREDENTIALS",
        }),
      );
    });

    it("rejects a wrong password", async () => {
      platformUserRepository.findByEmail.mockResolvedValue(fakePlatformUser());
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.login("priya@wapp.internal", "wrong", { userAgent: null, ipAddress: null }, false),
      ).rejects.toThrow(UnauthorizedException);
      expect(loginHistoryRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          platformUserId: "platform-user-1",
          success: false,
          reason: "INVALID_CREDENTIALS",
        }),
      );
    });

    it("rejects a disabled platform account", async () => {
      platformUserRepository.findByEmail.mockResolvedValue(fakePlatformUser({ isActive: false }));
      passwordService.compare.mockResolvedValue(true);

      await expect(
        service.login(
          "priya@wapp.internal",
          "Passw0rd1",
          { userAgent: null, ipAddress: null },
          false,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(platformUserRepository.recordSuccessfulLogin).not.toHaveBeenCalled();
      expect(loginHistoryRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          platformUserId: "platform-user-1",
          success: false,
          reason: "ACCOUNT_INACTIVE",
        }),
      );
    });
  });

  describe("refresh", () => {
    it("rotates the session and issues a new token pair", async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: "platform-user-1",
        jti: "old-jti",
        type: "platform_refresh",
      });
      sessionRepository.findByJti.mockResolvedValue(fakePlatformSession({ jti: "old-jti" }));
      platformUserRepository.findById.mockResolvedValue(fakePlatformUser());

      const result = await service.refresh("some-refresh-token", {
        userAgent: null,
        ipAddress: null,
      });

      expect(result.accessToken).toBe("access-token");
      expect(sessionRepository.revokeByJti).toHaveBeenCalledWith("old-jti", "new-jti");
    });

    it("revokes every session for the user on reuse of a revoked token", async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: "platform-user-1",
        jti: "stolen-jti",
        type: "platform_refresh",
      });
      sessionRepository.findByJti.mockResolvedValue(
        fakePlatformSession({ jti: "stolen-jti", revokedAt: new Date() }),
      );

      await expect(
        service.refresh("stolen-token", { userAgent: null, ipAddress: null }),
      ).rejects.toThrow(UnauthorizedException);
      expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith("platform-user-1");
    });

    it("rejects when the session no longer exists", async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: "platform-user-1",
        jti: "missing-jti",
        type: "platform_refresh",
      });
      sessionRepository.findByJti.mockResolvedValue(null);

      await expect(service.refresh("token", { userAgent: null, ipAddress: null })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("rejects refresh for a deactivated platform account", async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: "platform-user-1",
        jti: "jti-1",
        type: "platform_refresh",
      });
      sessionRepository.findByJti.mockResolvedValue(fakePlatformSession());
      platformUserRepository.findById.mockResolvedValue(fakePlatformUser({ isActive: false }));

      await expect(service.refresh("token", { userAgent: null, ipAddress: null })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("logout", () => {
    it("revokes the session for a valid refresh token", async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: "platform-user-1",
        jti: "jti-1",
        type: "platform_refresh",
      });

      await service.logout("refresh-token");

      expect(sessionRepository.revokeByJti).toHaveBeenCalledWith("jti-1");
    });

    it("is idempotent for an already-invalid token", async () => {
      tokenService.verifyRefreshToken.mockImplementation(() => {
        throw new UnauthorizedException();
      });

      await expect(service.logout("garbage")).resolves.toBeUndefined();
      expect(sessionRepository.revokeByJti).not.toHaveBeenCalled();
    });
  });
});
