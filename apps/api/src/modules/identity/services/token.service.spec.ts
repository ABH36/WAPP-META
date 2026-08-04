import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import { TokenService } from "./token.service.js";

describe("TokenService", () => {
  let service: TokenService;

  const mockConfig = {
    get: (key: string) => {
      if (key === "jwt") {
        return {
          accessSecret: "test-access-secret",
          refreshSecret: "test-refresh-secret",
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
      providers: [TokenService, { provide: ConfigService, useValue: mockConfig }],
    }).compile();

    service = moduleRef.get(TokenService);
  });

  describe("access tokens", () => {
    it("round-trips a signed access token", () => {
      const { token, expiresIn } = service.signAccessToken({
        sub: "user-1",
        workspaceId: "workspace-1",
        role: null,
        emailVerified: true,
      });

      expect(expiresIn).toBe(15 * 60);

      const payload = service.verifyAccessToken(token);
      expect(payload).toMatchObject({
        sub: "user-1",
        workspaceId: "workspace-1",
        role: null,
        emailVerified: true,
        type: "access",
      });
    });

    it("rejects a malformed token", () => {
      expect(() => service.verifyAccessToken("not-a-real-token")).toThrow(UnauthorizedException);
    });

    it("rejects a token signed with a different secret", () => {
      const foreignJwt = new JwtService();
      const foreignToken = foreignJwt.sign(
        { sub: "user-1", workspaceId: null, role: null, emailVerified: true, type: "access" },
        { secret: "some-other-secret", expiresIn: "15m" },
      );
      expect(() => service.verifyAccessToken(foreignToken)).toThrow(UnauthorizedException);
    });

    it("rejects a refresh token presented as an access token", () => {
      const { token } = service.signRefreshToken("user-1");
      // Different secret entirely, so verification fails at the signature step.
      expect(() => service.verifyAccessToken(token)).toThrow(UnauthorizedException);
    });
  });

  describe("refresh tokens", () => {
    it("round-trips a signed refresh token with a unique jti", () => {
      const issued = service.signRefreshToken("user-1");
      const payload = service.verifyRefreshToken(issued.token);

      expect(payload.sub).toBe("user-1");
      expect(payload.jti).toBe(issued.jti);
      expect(payload.type).toBe("refresh");
    });

    it("generates a different jti on each call", () => {
      const first = service.signRefreshToken("user-1");
      const second = service.signRefreshToken("user-1");
      expect(first.jti).not.toBe(second.jti);
    });

    it("sets expiresAt roughly 30 days out", () => {
      const before = Date.now();
      const { expiresAt } = service.signRefreshToken("user-1");
      const thirtyDaysMs = 30 * 86_400 * 1000;
      expect(expiresAt.getTime()).toBeGreaterThan(before + thirtyDaysMs - 5000);
      expect(expiresAt.getTime()).toBeLessThan(before + thirtyDaysMs + 5000);
    });
  });

  describe("opaque tokens", () => {
    it("generates high-entropy, distinct tokens", () => {
      const a = service.generateOpaqueToken();
      const b = service.generateOpaqueToken();
      expect(a).toHaveLength(64); // 32 bytes hex-encoded
      expect(a).not.toBe(b);
    });

    it("hashes deterministically", () => {
      const raw = service.generateOpaqueToken();
      expect(service.hashOpaqueToken(raw)).toBe(service.hashOpaqueToken(raw));
      expect(service.hashOpaqueToken(raw)).toHaveLength(64); // sha256 hex
    });

    it("produces different hashes for different tokens", () => {
      const a = service.generateOpaqueToken();
      const b = service.generateOpaqueToken();
      expect(service.hashOpaqueToken(a)).not.toBe(service.hashOpaqueToken(b));
    });
  });
});
