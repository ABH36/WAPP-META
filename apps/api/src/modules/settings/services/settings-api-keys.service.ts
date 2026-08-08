import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ApiKeyService } from "../../identity/services/api-key.service.js";
import type { GeneratedApiKey } from "../../identity/services/api-key.service.js";
import { ApiKeyScope } from "../../identity/schemas/api-key.schema.js";
import type { ApiKeySummary } from "../../identity/identity.types.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  ApiKeyCreatedPayload,
  ApiKeyRevokedPayload,
} from "../../../common/events/domain-events.js";
import type { CreateApiKeyDto } from "../dto/create-api-key.dto.js";

/**
 * PRD-006 Volume-3 §4.4 — thin proxy over Identity's ApiKeyService
 * (ADR-SET-005), same shape as ADR-SET-004's SecuritySettingsService ->
 * AuthService. Settings owns none of the key material; every method here is
 * a one-line delegation plus the Settings-owned domain event.
 */
@Injectable()
export class SettingsApiKeysService {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(workspaceId: string): Promise<ApiKeySummary[]> {
    return this.apiKeyService.list(workspaceId);
  }

  async create(
    workspaceId: string,
    actorId: string,
    dto: CreateApiKeyDto,
  ): Promise<GeneratedApiKey> {
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    const result = await this.apiKeyService.generate(
      workspaceId,
      actorId,
      dto.name,
      dto.scope ?? ApiKeyScope.READ,
      expiresAt,
    );

    this.eventEmitter.emit(DomainEvent.API_KEY_CREATED, {
      workspaceId,
      apiKeyId: result.apiKey.id,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies ApiKeyCreatedPayload);

    return result;
  }

  async revoke(workspaceId: string, actorId: string, id: string): Promise<ApiKeySummary> {
    const revoked = await this.apiKeyService.revoke(workspaceId, id);

    this.eventEmitter.emit(DomainEvent.API_KEY_REVOKED, {
      workspaceId,
      apiKeyId: id,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies ApiKeyRevokedPayload);

    return revoked;
  }

  /** §4.4 "Rotate" — not in §9's literal endpoint list but explicitly named as a supported action; revoke-then-generate in one call. */
  async rotate(workspaceId: string, actorId: string, id: string): Promise<GeneratedApiKey> {
    const result = await this.apiKeyService.rotate(workspaceId, id, actorId);

    this.eventEmitter.emit(DomainEvent.API_KEY_REVOKED, {
      workspaceId,
      apiKeyId: id,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies ApiKeyRevokedPayload);
    this.eventEmitter.emit(DomainEvent.API_KEY_CREATED, {
      workspaceId,
      apiKeyId: result.apiKey.id,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies ApiKeyCreatedPayload);

    return result;
  }
}
