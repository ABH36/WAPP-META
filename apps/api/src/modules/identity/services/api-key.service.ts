import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { ApiKeyRepository } from "../repositories/api-key.repository.js";
import { PasswordService } from "./password.service.js";
import { ApiKeyScope } from "../schemas/api-key.schema.js";
import { toApiKeySummary } from "../mappers/user.mapper.js";
import type { ApiKeySummary } from "../identity.types.js";

const KEY_PREFIX = "wapp";
const PREFIX_LENGTH = 8;

export interface GeneratedApiKey {
  apiKey: ApiKeySummary;
  /** Shown exactly once (BR-007) — never persisted or logged in plaintext. */
  rawKey: string;
}

export interface ValidatedApiKeyContext {
  apiKeyId: string;
  workspaceId: string;
  scope: ApiKeyScope;
}

/**
 * PRD-006 Volume-3 §4.4 — Identity owns key generation/validation (§3:
 * "Identity Owns: API authentication"); Settings' ApiKeysController is a
 * thin proxy over this service, the same shape as SecuritySettingsService ->
 * AuthService (ADR-SET-004). Keys are bcrypt-hashed via PasswordService,
 * mirroring password storage exactly — a key, like a password, is only ever
 * verified, never decrypted back to plaintext (unlike WABA tokens/webhook
 * secrets, which use TokenEncryptionService because they must be read back).
 */
@Injectable()
export class ApiKeyService {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly passwordService: PasswordService,
  ) {}

  async generate(
    workspaceId: string,
    createdBy: string,
    name: string,
    scope: ApiKeyScope,
    expiresAt: Date | null,
  ): Promise<GeneratedApiKey> {
    const secret = randomBytes(32).toString("hex");
    const prefix = secret.slice(0, PREFIX_LENGTH);
    const keyHash = await this.passwordService.hash(secret);

    const created = await this.apiKeyRepository.create({
      workspaceId,
      name,
      prefix,
      keyHash,
      scope,
      createdBy,
      expiresAt,
    });

    return {
      apiKey: toApiKeySummary(created),
      rawKey: `${KEY_PREFIX}_${secret}`,
    };
  }

  async list(workspaceId: string): Promise<ApiKeySummary[]> {
    const keys = await this.apiKeyRepository.findByWorkspace(workspaceId);
    return keys.map(toApiKeySummary);
  }

  async revoke(workspaceId: string, id: string): Promise<ApiKeySummary> {
    const revoked = await this.apiKeyRepository.revoke(workspaceId, id);
    if (!revoked) {
      throw new NotFoundException("Active API key not found");
    }
    return toApiKeySummary(revoked);
  }

  /** Revoke-then-generate in one call — the old key stops working the instant the new one is issued, never both valid at once. */
  async rotate(workspaceId: string, id: string, createdBy: string): Promise<GeneratedApiKey> {
    const existing = await this.apiKeyRepository.findActiveByIdForWorkspace(workspaceId, id);
    if (!existing) {
      throw new NotFoundException("Active API key not found");
    }
    await this.apiKeyRepository.revoke(workspaceId, id);
    return this.generate(workspaceId, createdBy, existing.name, existing.scope, existing.expiresAt);
  }

  /**
   * Not consumed by any endpoint yet — no protected public API surface
   * exists in this volume (§4.4/§12 name "Developer Settings" as a future
   * concern). Built now so the key is a genuinely verifiable credential, not
   * just a database row; ApiKeyGuard is ready to wire onto a route the day a
   * Developer API surface is actually exposed. See
   * docs/ADR-SET-005-integration-ownership-strategy.md.
   */
  async validate(rawKey: string): Promise<ValidatedApiKeyContext | null> {
    if (!rawKey.startsWith(`${KEY_PREFIX}_`)) {
      return null;
    }
    const secret = rawKey.slice(KEY_PREFIX.length + 1);
    const prefix = secret.slice(0, PREFIX_LENGTH);
    const candidates = await this.apiKeyRepository.findActiveByPrefix(prefix);

    for (const candidate of candidates) {
      if (candidate.expiresAt && candidate.expiresAt.getTime() < Date.now()) {
        continue;
      }
      const matches = await this.passwordService.compare(secret, candidate.keyHash);
      if (matches) {
        await this.apiKeyRepository.markUsed(candidate._id.toString());
        return {
          apiKeyId: candidate._id.toString(),
          workspaceId: candidate.workspaceId,
          scope: candidate.scope,
        };
      }
    }
    return null;
  }
}
