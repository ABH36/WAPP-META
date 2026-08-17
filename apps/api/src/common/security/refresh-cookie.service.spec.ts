import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import type { CookieOptions, Request, Response } from "express";
import { RefreshCookieService } from "./refresh-cookie.service.js";

interface FakeResponse {
  cookie: jest.Mock<Response, [name: string, value: string, options: CookieOptions]>;
  clearCookie: jest.Mock<Response, [name: string, options: CookieOptions]>;
}

function fakeResponse(): FakeResponse {
  return {
    cookie: jest.fn<Response, [name: string, value: string, options: CookieOptions]>(),
    clearCookie: jest.fn<Response, [name: string, options: CookieOptions]>(),
  };
}

async function buildService(env: string, cookieDomain?: string): Promise<RefreshCookieService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      RefreshCookieService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => {
            if (key === "env") return env;
            if (key === "cookieDomain") return cookieDomain;
            throw new Error(`Unexpected config key: ${key}`);
          },
        },
      },
    ],
  }).compile();

  return moduleRef.get(RefreshCookieService);
}

describe("RefreshCookieService", () => {
  describe("set", () => {
    it("sets an httpOnly, lax, path=/ cookie with no Max-Age/Expires when rememberMe is false (session cookie)", async () => {
      const service = await buildService("development");
      const response = fakeResponse();
      const expiresAt = new Date(Date.now() + 60_000);

      service.set(response as unknown as Response, "wapp_web_rt", "raw-token", false, expiresAt);

      expect(response.cookie).toHaveBeenCalledWith(
        "wapp_web_rt",
        "raw-token",
        expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
      );
      const options = response.cookie.mock.calls[0]![2];
      expect(options).not.toHaveProperty("expires");
    });

    it("sets an Expires matching the token's own expiry when rememberMe is true (persistent cookie)", async () => {
      const service = await buildService("development");
      const response = fakeResponse();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      service.set(response as unknown as Response, "wapp_web_rt", "raw-token", true, expiresAt);

      const options = response.cookie.mock.calls[0]![2];
      expect(options.expires).toBe(expiresAt);
    });

    it("omits `secure` in development (plain http)", async () => {
      const service = await buildService("development");
      const response = fakeResponse();

      service.set(response as unknown as Response, "wapp_web_rt", "raw-token", false, new Date());

      const options = response.cookie.mock.calls[0]![2];
      expect(options.secure).toBe(false);
    });

    it("sets `secure: true` in production", async () => {
      const service = await buildService("production");
      const response = fakeResponse();

      service.set(response as unknown as Response, "wapp_web_rt", "raw-token", false, new Date());

      const options = response.cookie.mock.calls[0]![2];
      expect(options.secure).toBe(true);
    });

    it("omits `domain` when COOKIE_DOMAIN is unset (host-only cookie)", async () => {
      const service = await buildService("production");
      const response = fakeResponse();

      service.set(response as unknown as Response, "wapp_admin_rt", "raw-token", false, new Date());

      const options = response.cookie.mock.calls[0]![2];
      expect(options).not.toHaveProperty("domain");
    });

    it("sets `domain` when COOKIE_DOMAIN is configured", async () => {
      const service = await buildService("production", ".wapp.example");
      const response = fakeResponse();

      service.set(response as unknown as Response, "wapp_admin_rt", "raw-token", false, new Date());

      const options = response.cookie.mock.calls[0]![2];
      expect(options.domain).toBe(".wapp.example");
    });
  });

  describe("clear", () => {
    it("clears the named cookie with matching httpOnly/sameSite/path attributes", async () => {
      const service = await buildService("production", ".wapp.example");
      const response = fakeResponse();

      service.clear(response as unknown as Response, "wapp_web_rt");

      expect(response.clearCookie).toHaveBeenCalledWith(
        "wapp_web_rt",
        expect.objectContaining({
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: true,
          domain: ".wapp.example",
        }),
      );
    });
  });

  describe("read", () => {
    it("returns the cookie value when present", async () => {
      const service = await buildService("development");
      const request = { cookies: { wapp_web_rt: "raw-token" } } as unknown as Request;

      expect(service.read(request, "wapp_web_rt")).toBe("raw-token");
    });

    it("returns undefined when the cookie is absent", async () => {
      const service = await buildService("development");
      const request = { cookies: {} } as unknown as Request;

      expect(service.read(request, "wapp_web_rt")).toBeUndefined();
    });

    it("returns undefined when request.cookies itself is undefined (cookie-parser not registered)", async () => {
      const service = await buildService("development");
      const request = {} as unknown as Request;

      expect(service.read(request, "wapp_web_rt")).toBeUndefined();
    });
  });
});
