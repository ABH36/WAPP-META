import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ThirdPartyAppRepository } from "../repositories/third-party-app.repository.js";
import { ThirdPartyAppKey } from "../schemas/third-party-app.schema.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  IntegrationConnectedPayload,
  IntegrationDisconnectedPayload,
} from "../../../common/events/domain-events.js";
import type { ThirdPartyAppSummary } from "../settings.types.js";

const ALL_APP_KEYS = Object.values(ThirdPartyAppKey);

/** PRD-006 Volume-3 §4.6 — pure enable/disable, no execution semantics. Every workspace implicitly has all 4 apps in a disabled state until toggled. */
@Injectable()
export class ThirdPartyAppsService {
  constructor(
    private readonly thirdPartyAppRepository: ThirdPartyAppRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(workspaceId: string): Promise<ThirdPartyAppSummary[]> {
    const states = await this.thirdPartyAppRepository.findByWorkspace(workspaceId);
    const enabledByKey = new Map(states.map((state) => [state.appKey, state.enabled]));
    return ALL_APP_KEYS.map((appKey) => ({
      appKey,
      enabled: enabledByKey.get(appKey) ?? false,
    }));
  }

  async setEnabled(
    workspaceId: string,
    actorId: string,
    appKey: ThirdPartyAppKey,
    enabled: boolean,
  ): Promise<ThirdPartyAppSummary> {
    const updated = await this.thirdPartyAppRepository.setEnabled(workspaceId, appKey, enabled);

    const eventPayload = {
      workspaceId,
      integrationType: "THIRD_PARTY_APP" as const,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies IntegrationConnectedPayload | IntegrationDisconnectedPayload;
    this.eventEmitter.emit(
      enabled ? DomainEvent.INTEGRATION_CONNECTED : DomainEvent.INTEGRATION_DISCONNECTED,
      eventPayload,
    );

    return { appKey: updated.appKey, enabled: updated.enabled };
  }
}
