import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { FeatureFlagRepository } from "../repositories/feature-flag.repository.js";
import { FeatureFlagKey } from "../schemas/feature-flag-state.schema.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { FeatureFlagUpdatedPayload } from "../../../common/events/domain-events.js";
import type { FeatureFlagSummary } from "../settings.types.js";

const ALL_FLAG_KEYS = Object.values(FeatureFlagKey);

/** PRD-006 Volume-4 §4.5 — workspace-level visibility toggles only; business modules remain responsible for enforcing real entitlement (BR-005). */
@Injectable()
export class FeatureFlagsService {
  constructor(
    private readonly featureFlagRepository: FeatureFlagRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(workspaceId: string): Promise<FeatureFlagSummary[]> {
    const states = await this.featureFlagRepository.findByWorkspace(workspaceId);
    const byKey = new Map(states.map((state) => [state.flagKey, state.enabled]));
    return ALL_FLAG_KEYS.map((flagKey) => ({
      flagKey,
      enabled: byKey.get(flagKey) ?? FeatureFlagRepository.defaultFor(flagKey),
    }));
  }

  async setEnabled(
    workspaceId: string,
    actorId: string,
    flagKey: FeatureFlagKey,
    enabled: boolean,
  ): Promise<FeatureFlagSummary> {
    const updated = await this.featureFlagRepository.setEnabled(workspaceId, flagKey, enabled);

    this.eventEmitter.emit(DomainEvent.FEATURE_FLAG_UPDATED, {
      workspaceId,
      flagKey,
      enabled,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies FeatureFlagUpdatedPayload);

    return { flagKey: updated.flagKey, enabled: updated.enabled };
  }
}
