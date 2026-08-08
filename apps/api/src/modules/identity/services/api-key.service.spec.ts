import { Test } from "@nestjs/testing";
import { ApiKeyService } from "./api-key.service.js";
import { ApiKeyRepository } from "../repositories/api-key.repository.js";
import { PasswordService } from "./password.service.js";
import { ApiKeyScope, ApiKeyStatus } from "../schemas/api-key.schema.js";

function fakeApiKey(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => "key-1" },
    workspaceId: "workspace-1",
    name: "CI integration",
    prefix: "abcd1234",
    keyHash: "hashed",
    scope: ApiKeyScope.READ,
    status: ApiKeyStatus.ACTIVE,
    createdBy: { toString: () => "user-1" },
    lastUsedAt: null,
    expiresAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("ApiKeyService", () => {
  let service: ApiKeyService;
  let apiKeyRepository: jest.Mocked<ApiKeyRepository>;
  let passwordService: jest.Mocked<PasswordService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        {
          provide: ApiKeyRepository,
          useValue: {
            create: jest.fn(),
            findByWorkspace: jest.fn(),
            findActiveByIdForWorkspace: jest.fn(),
            findActiveByPrefix: jest.fn(),
            markUsed: jest.fn(),
            revoke: jest.fn(),
          },
        },
        { provide: PasswordService, useValue: { hash: jest.fn(), compare: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(ApiKeyService);
    apiKeyRepository = moduleRef.get(ApiKeyRepository);
    passwordService = moduleRef.get(PasswordService);
  });

  describe("generate", () => {
    it("hashes the secret via PasswordService (bcrypt) and returns the raw key exactly once", async () => {
      passwordService.hash.mockResolvedValue("hashed-secret");
      apiKeyRepository.create.mockResolvedValue(fakeApiKey() as never);

      const result = await service.generate(
        "workspace-1",
        "user-1",
        "CI integration",
        ApiKeyScope.READ,
        null,
      );

      expect(passwordService.hash).toHaveBeenCalled();
      expect(apiKeyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "workspace-1",
          name: "CI integration",
          keyHash: "hashed-secret",
          scope: ApiKeyScope.READ,
          createdBy: "user-1",
          expiresAt: null,
        }),
      );
      expect(result.rawKey).toMatch(/^wapp_[0-9a-f]{64}$/);
      expect(result.apiKey.id).toBe("key-1");
    });
  });

  describe("revoke", () => {
    it("throws NotFoundException when no active key matches", async () => {
      apiKeyRepository.revoke.mockResolvedValue(null);
      await expect(service.revoke("workspace-1", "key-1")).rejects.toThrow(
        "Active API key not found",
      );
    });

    it("returns the revoked key summary — BR-008, no reactivate path exists anywhere", async () => {
      apiKeyRepository.revoke.mockResolvedValue(
        fakeApiKey({ status: ApiKeyStatus.REVOKED }) as never,
      );
      const result = await service.revoke("workspace-1", "key-1");
      expect(result.status).toBe(ApiKeyStatus.REVOKED);
    });
  });

  describe("rotate", () => {
    it("revokes the old key and generates a new one with the same name/scope/expiry", async () => {
      apiKeyRepository.findActiveByIdForWorkspace.mockResolvedValue(
        fakeApiKey({ name: "CI integration", scope: ApiKeyScope.WRITE }) as never,
      );
      apiKeyRepository.revoke.mockResolvedValue(
        fakeApiKey({ status: ApiKeyStatus.REVOKED }) as never,
      );
      passwordService.hash.mockResolvedValue("hashed-secret");
      apiKeyRepository.create.mockResolvedValue(
        fakeApiKey({ _id: { toString: () => "key-2" }, scope: ApiKeyScope.WRITE }) as never,
      );

      const result = await service.rotate("workspace-1", "key-1", "user-1");

      expect(apiKeyRepository.revoke).toHaveBeenCalledWith("workspace-1", "key-1");
      expect(apiKeyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "CI integration", scope: ApiKeyScope.WRITE }),
      );
      expect(result.apiKey.id).toBe("key-2");
    });

    it("throws NotFoundException when no active key matches", async () => {
      apiKeyRepository.findActiveByIdForWorkspace.mockResolvedValue(null);
      await expect(service.rotate("workspace-1", "key-1", "user-1")).rejects.toThrow(
        "Active API key not found",
      );
    });
  });

  describe("validate", () => {
    it("returns null for a key without the wapp_ prefix", async () => {
      await expect(service.validate("not-a-wapp-key")).resolves.toBeNull();
      expect(apiKeyRepository.findActiveByPrefix).not.toHaveBeenCalled();
    });

    it("returns null when no candidate's hash matches", async () => {
      apiKeyRepository.findActiveByPrefix.mockResolvedValue([fakeApiKey() as never]);
      passwordService.compare.mockResolvedValue(false);
      await expect(service.validate(`wapp_${"a".repeat(64)}`)).resolves.toBeNull();
    });

    it("skips an expired candidate even if the secret would otherwise match", async () => {
      apiKeyRepository.findActiveByPrefix.mockResolvedValue([
        fakeApiKey({ expiresAt: new Date("2020-01-01T00:00:00.000Z") }) as never,
      ]);
      const result = await service.validate(`wapp_${"a".repeat(64)}`);
      expect(result).toBeNull();
      expect(passwordService.compare).not.toHaveBeenCalled();
    });

    it("marks the key used and returns its context on a valid match", async () => {
      apiKeyRepository.findActiveByPrefix.mockResolvedValue([fakeApiKey() as never]);
      passwordService.compare.mockResolvedValue(true);

      const result = await service.validate(`wapp_${"a".repeat(64)}`);

      expect(apiKeyRepository.markUsed).toHaveBeenCalledWith("key-1");
      expect(result).toEqual({
        apiKeyId: "key-1",
        workspaceId: "workspace-1",
        scope: ApiKeyScope.READ,
      });
    });
  });
});
