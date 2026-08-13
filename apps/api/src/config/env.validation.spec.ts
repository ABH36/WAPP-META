import "reflect-metadata";
import { validateEnv } from "./env.validation.js";

/** A complete, valid config object — every test starts from a clone of this and mutates one field. */
function validConfig(): Record<string, unknown> {
  return {
    NODE_ENV: "development",
    PORT: "4000",
    MONGODB_URI: "mongodb://localhost:27017/wapp",
    REDIS_URL: "redis://localhost:6379",
    JWT_ACCESS_SECRET: "access-secret-1",
    JWT_REFRESH_SECRET: "refresh-secret-1",
    PLATFORM_JWT_ACCESS_SECRET: "platform-access-secret-1",
    PLATFORM_JWT_REFRESH_SECRET: "platform-refresh-secret-1",
    RESEND_API_KEY: "resend-key",
    RESEND_FROM_ADDRESS: "no-reply@wapp.example",
    CLOUDINARY_CLOUD_NAME: "wapp-cloud",
    CLOUDINARY_API_KEY: "cloudinary-key",
    CLOUDINARY_API_SECRET: "cloudinary-secret",
    WEB_APP_URL: "http://localhost:3000",
    ADMIN_APP_URL: "http://localhost:3001",
    META_APP_ID: "meta-app-id",
    META_APP_SECRET: "meta-app-secret",
    META_WEBHOOK_VERIFY_TOKEN: "meta-webhook-token",
    TOKEN_ENCRYPTION_KEY: "0".repeat(64),
  };
}

describe("validateEnv", () => {
  it("accepts a fully valid config", () => {
    expect(() => validateEnv(validConfig())).not.toThrow();
  });

  it("rejects a missing required variable", () => {
    const config = validConfig();
    delete config.MONGODB_URI;
    expect(() => validateEnv(config)).toThrow(/Environment configuration is invalid/);
  });

  it("rejects a malformed TOKEN_ENCRYPTION_KEY", () => {
    const config = validConfig();
    config.TOKEN_ENCRYPTION_KEY = "not-64-hex-chars";
    expect(() => validateEnv(config)).toThrow(/Environment configuration is invalid/);
  });

  it("accepts an unset COOKIE_DOMAIN (optional)", () => {
    const config = validConfig();
    delete config.COOKIE_DOMAIN;
    expect(() => validateEnv(config)).not.toThrow();
  });

  it("accepts a configured COOKIE_DOMAIN", () => {
    const config = validConfig();
    config.COOKIE_DOMAIN = ".wapp.example";
    expect(() => validateEnv(config)).not.toThrow();
  });

  // PHD-001 Volume-1 — the boot-time check that a leaked tenant secret can
  // never forge a Platform Administration session, and vice versa.
  describe.each([
    ["JWT_ACCESS_SECRET", "PLATFORM_JWT_ACCESS_SECRET"],
    ["JWT_ACCESS_SECRET", "PLATFORM_JWT_REFRESH_SECRET"],
    ["JWT_REFRESH_SECRET", "PLATFORM_JWT_ACCESS_SECRET"],
    ["JWT_REFRESH_SECRET", "PLATFORM_JWT_REFRESH_SECRET"],
    ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"],
    ["PLATFORM_JWT_ACCESS_SECRET", "PLATFORM_JWT_REFRESH_SECRET"],
  ])("secret-collision check: %s vs %s", (a, b) => {
    it(`rejects when ${a} equals ${b}`, () => {
      const config = validConfig();
      config[a] = "shared-secret-value";
      config[b] = "shared-secret-value";
      expect(() => validateEnv(config)).toThrow(`${a} and ${b} must not be equal.`);
    });
  });

  it("accepts when all four JWT secrets are pairwise distinct", () => {
    const config = validConfig();
    config.JWT_ACCESS_SECRET = "a";
    config.JWT_REFRESH_SECRET = "b";
    config.PLATFORM_JWT_ACCESS_SECRET = "c";
    config.PLATFORM_JWT_REFRESH_SECRET = "d";
    expect(() => validateEnv(config)).not.toThrow();
  });
});
