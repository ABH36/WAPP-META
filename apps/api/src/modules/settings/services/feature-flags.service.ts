import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { FeatureFlagRepository } from "../repositories/feature-flag.repository.js";
import { PlatformFeatureOverrideRepository } from "../repositories/platform-feature-override.repository.js";
import { FeatureFlagKey } from "../schemas/feature-flag-state.schema.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { FeatureFlagUpdatedPayload } from "../../../common/events/domain-events.js";
import type { FeatureFlagSummary } from "../settings.types.js";

const ALL_FLAG_KEYS = Object.values(FeatureFlagKey);

/**
 * PRD-006 Volume-4 §4.5 — workspace-level visibility toggles; business
 * modules remain responsible for enforcing real entitlement (BR-005).
 * PRD-007 Volume-1 §4.5 extends this with a platform-override tier: a
 * platform-wide override (via `PlatformFeatureOverrideRepository`'s local
 * read model) always wins over the workspace's own toggle when present —
 * resolution order is platform override -> workspace toggle -> hardcoded
 * default. A workspace's own `setEnabled` write is preserved underneath and
 * takes effect again once the platform override is cleared.
 */
@Injectable()
export class FeatureFlagsService {
  constructor(
    private readonly featureFlagRepository: FeatureFlagRepository,
    private readonly platformFeatureOverrideRepository: PlatformFeatureOverrideRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(workspaceId: string): Promise<FeatureFlagSummary[]> {
    const [states, overrides] = await Promise.all([
      this.featureFlagRepository.findByWorkspace(workspaceId),
      this.platformFeatureOverrideRepository.findAll(),
    ]);
    const byKey = new Map(states.map((state) => [state.flagKey, state.enabled]));
    const overrideByKey = new Map(
      overrides.map((override) => [override.flagKey, override.enabled]),
    );
    return ALL_FLAG_KEYS.map((flagKey) => ({
      flagKey,
      enabled:
        overrideByKey.get(flagKey) ??
        byKey.get(flagKey) ??
        FeatureFlagRepository.defaultFor(flagKey),
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
