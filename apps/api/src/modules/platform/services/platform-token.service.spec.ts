import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import { PlatformRole } from "@wapp/shared-types";
import { PlatformTokenService } from "./platform-token.service.js";

describe("PlatformTokenService", () => {
  let service: PlatformTokenService;

  const mockConfig = {
    get: (key: string) => {
      if (key === "platformJwt") {
        return {
          accessSecret: "test-platform-access-secret",
          refreshSecret: "test-platform-refresh-secret",
          accessTtl: "15m",
          refreshTtl: "30d",
        };
      }
      throw new Error(`Unexpected config key in test: ${key}`);
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [PlatformTokenService, { provide: ConfigService, useValue: mockConfig }],
    }).compile();

    service = moduleRef.get(PlatformTokenService);
  });

  describe("access tokens", () => {
    it("round-trips a signed access token", () => {
      const { token, expiresIn } = service.signAccessToken({
        sub: "platform-user-1",
        role: PlatformRole.PLATFORM_SUPER_ADMIN,
      });

      expect(expiresIn).toBe(15 * 60);

      const payload = service.verifyAccessToken(token);
      expect(payload).toMatchObject({
        sub: "platform-user-1",
        role: PlatformRole.PLATFORM_SUPER_ADMIN,
        type: "platform_access",
      });
    });

    it("rejects a malformed token", () => {
      expect(() => service.verifyAccessToken("not-a-real-token")).toThrow(UnauthorizedException);
    });

    it("rejects a token signed with a different secret", () => {
      const foreignJwt = new JwtService();
      const foreignToken = foreignJwt.sign(
        {
          sub: "platform-user-1",
          role: PlatformRole.PLATFORM_SUPER_ADMIN,
          type: "platform_access",
        },
        { secret: "some-other-secret", expiresIn: "15m" },
      );
      expect(() => service.verifyAccessToken(foreignToken)).toThrow(UnauthorizedException);
    });

    it("rejects a tenant access token even if somehow signed with the same secret", () => {
      const sameSecretJwt = new JwtService();
      const tenantShapedToken = sameSecretJwt.sign(
        { sub: "user-1", workspaceId: null, role: null, emailVerified: true, type: "access" },
        { secret: "test-platform-access-secret", expiresIn: "15m" },
      );
      expect(() => service.verifyAccessToken(tenantShapedToken)).toThrow(UnauthorizedException);
    });

    it("rejects a refresh token presented as an access token", () => {
      const { token } = service.signRefreshToken("platform-user-1");
      expect(() => service.verifyAccessToken(token)).toThrow(UnauthorizedException);
    });
  });

  describe("refresh tokens", () => {
    it("round-trips a signed refresh token with a unique jti", () => {
      const issued = service.signRefreshToken("platform-user-1");
      const payload = service.verifyRefreshToken(issued.token);

      expect(payload.sub).toBe("platform-user-1");
      expect(payload.jti).toBe(issued.jti);
      expect(payload.type).toBe("platform_refresh");
    });

    it("generates a different jti on each call", () => {
      const first = service.signRefreshToken("platform-user-1");
      const second = service.signRefreshToken("platform-user-1");
      expect(first.jti).not.toBe(second.jti);
    });
  });

  describe("hashOpaqueToken", () => {
    it("hashes deterministically", () => {
      const { token } = service.signRefreshToken("platform-user-1");
      expect(service.hashOpaqueToken(token)).toBe(service.hashOpaqueToken(token));
      expect(service.hashOpaqueToken(token)).toHaveLength(64); // sha256 hex
    });
  });
});
