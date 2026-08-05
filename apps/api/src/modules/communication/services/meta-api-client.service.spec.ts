import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { MetaApiClient } from "./meta-api-client.service.js";
import {
  MetaAuthenticationException,
  MetaRateLimitException,
  MetaTemporaryException,
  MetaUnknownException,
  MetaValidationException,
} from "../exceptions/meta-api.exceptions.js";

function fakeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "error",
    headers: { get: (name: string) => headers[name] ?? null },
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("MetaApiClient", () => {
  let service: MetaApiClient;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const moduleRef = await Test.createTestingModule({
      providers: [
        MetaApiClient,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "meta") {
                return {
                  appId: "app-id",
                  appSecret: "app-secret",
                  webhookVerifyToken: "verify-token",
                  graphApiVersion: "v26.0",
                };
              }
              throw new Error(`Unexpected config key: ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(MetaApiClient);
  });

  it("classifies code 190 as an authentication failure", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(401, { error: { message: "Token expired", code: 190 } }),
    );
    await expect(service.sendTextMessage("phone-1", "token", "+91987", "hi")).rejects.toThrow(
      MetaAuthenticationException,
    );
  });

  it("classifies HTTP 429 as a rate limit, carrying Retry-After", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(429, { error: { message: "Rate limited" } }, { "Retry-After": "30" }),
    );
    try {
      await service.sendTextMessage("phone-1", "token", "+91987", "hi");
      fail("expected a MetaRateLimitException");
    } catch (error) {
      expect(error).toBeInstanceOf(MetaRateLimitException);
      expect((error as MetaRateLimitException).retryAfterSeconds).toBe(30);
    }
  });

  it("classifies a 5xx as temporary", async () => {
    fetchMock.mockResolvedValue(fakeResponse(503, { error: { message: "Down for maintenance" } }));
    await expect(service.sendTextMessage("phone-1", "token", "+91987", "hi")).rejects.toThrow(
      MetaTemporaryException,
    );
  });

  it("classifies is_transient:true as temporary even on a non-5xx status", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(400, { error: { message: "Transient issue", is_transient: true } }),
    );
    await expect(service.sendTextMessage("phone-1", "token", "+91987", "hi")).rejects.toThrow(
      MetaTemporaryException,
    );
  });

  it("classifies a plain HTTP 400 as validation", async () => {
    fetchMock.mockResolvedValue(fakeResponse(400, { error: { message: "Bad phone number" } }));
    await expect(service.sendTextMessage("phone-1", "token", "+91987", "hi")).rejects.toThrow(
      MetaValidationException,
    );
  });

  it("falls back to unknown for an unrecognized error shape", async () => {
    fetchMock.mockResolvedValue(fakeResponse(418, {}));
    await expect(service.sendTextMessage("phone-1", "token", "+91987", "hi")).rejects.toThrow(
      MetaUnknownException,
    );
  });
});
