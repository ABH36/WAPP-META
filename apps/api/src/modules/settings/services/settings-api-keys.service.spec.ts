import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SettingsApiKeysService } from "./settings-api-keys.service.js";
import { ApiKeyService } from "../../identity/services/api-key.service.js";
import { ApiKeyScope, ApiKeyStatus } from "../../identity/schemas/api-key.schema.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

const generated = {
  apiKey: {
    id: "key-1",
    name: "CI integration",
    prefix: "abcd1234",
    scope: ApiKeyScope.READ,
    status: ApiKeyStatus.ACTIVE,
    createdBy: "user-1",
    lastUsedAt: null,
    expiresAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  rawKey: "wapp_abcd1234...",
};

describe("SettingsApiKeysService", () => {
  let service: SettingsApiKeysService;
  let apiKeyService: jest.Mocked<ApiKeyService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SettingsApiKeysService,
        {
          provide: ApiKeyService,
          useValue: {
            list: jest.fn(),
            generate: jest.fn(),
            revoke: jest.fn(),
            rotate: jest.fn(),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        MetricsService,
      ],
    }).compile();

    service = moduleRef.get(SettingsApiKeysService);
    apiKeyService = moduleRef.get(ApiKeyService);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  it("create() delegates to Identity's ApiKeyService and emits API_KEY_CREATED", async () => {
    apiKeyService.generate.mockResolvedValue(generated);

    const result = await service.create("workspace-1", "user-1", { name: "CI integration" });

    expect(apiKeyService.generate).toHaveBeenCalledWith(
      "workspace-1",
      "user-1",
      "CI integration",
      ApiKeyScope.READ,
      null,
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.API_KEY_CREATED,
      expect.objectContaining({ workspaceId: "workspace-1", apiKeyId: "key-1" }),
    );
    expect(result).toBe(generated);
  });

  it("revoke() delegates and emits API_KEY_REVOKED", async () => {
    apiKeyService.revoke.mockResolvedValue(generated.apiKey);

    await service.revoke("workspace-1", "user-1", "key-1");

    expect(apiKeyService.revoke).toHaveBeenCalledWith("workspace-1", "key-1");
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.API_KEY_REVOKED,
      expect.objectContaining({ apiKeyId: "key-1" }),
    );
  });

  it("rotate() emits both API_KEY_REVOKED (old) and API_KEY_CREATED (new)", async () => {
    apiKeyService.rotate.mockResolvedValue({
      ...generated,
      apiKey: { ...generated.apiKey, id: "key-2" },
    });

    await service.rotate("workspace-1", "user-1", "key-1");

    expect(apiKeyService.rotate).toHaveBeenCalledWith("workspace-1", "key-1", "user-1");
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.API_KEY_REVOKED,
      expect.objectContaining({ apiKeyId: "key-1" }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.API_KEY_CREATED,
      expect.objectContaining({ apiKeyId: "key-2" }),
    );
  });
});
