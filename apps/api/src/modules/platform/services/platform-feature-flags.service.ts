import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { FeatureFlagKey } from "../../settings/schemas/feature-flag-state.schema.js";
import { PlatformFeatureFlagOverrideRepository } from "../repositories/platform-feature-flag-override.repository.js";
import {
  DomainEvent,
  PlatformFeatureUpdatedPayload,
} from "../../../common/events/domain-events.js";

export interface PlatformFeatureFlagSummary {
  flagKey: FeatureFlagKey;
  /** Null when no platform override is set for this flag — Settings falls back to the workspace-level toggle/default. */
  enabled: boolean | null;
}

const ALL_FLAG_KEYS = Object.values(FeatureFlagKey);

/**
 * PRD-007 Volume-1 §4.5 — the platform-wide override tier. Settings never
 * imports this module directly (one-directional dependency graph, Platform
 * is the most downstream module) — it consumes `PLATFORM_FEATURE_UPDATED`
 * via its own listener + local read-model instead, the same event-driven
 * decoupling already established for Maintenance Mode (ADR-SET-008) and
 * Workspace Suspend/Archive (this volume).
 */
@Injectable()
export class PlatformFeatureFlagsService {
  constructor(
    private readonly platformFeatureFlagOverrideRepository: PlatformFeatureFlagOverrideRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(): Promise<PlatformFeatureFlagSummary[]> {
    const overrides = await this.platformFeatureFlagOverrideRepository.findAll();
    const byKey = new Map(overrides.map((override) => [override.flagKey, override.enabled]));
    return ALL_FLAG_KEYS.map((flagKey) => ({
      flagKey,
      enabled: byKey.get(flagKey) ?? null,
    }));
  }

  async setEnabled(
    flagKey: FeatureFlagKey,
    enabled: boolean,
    actorId: string,
  ): Promise<PlatformFeatureFlagSummary> {
    await this.platformFeatureFlagOverrideRepository.setEnabled(flagKey, enabled, actorId);

    const payload: PlatformFeatureUpdatedPayload = {
      flagKey,
      enabled,
      actorId,
      occurredAt: new Date().toISOString(),
    };
    this.eventEmitter.emit(DomainEvent.PLATFORM_FEATURE_UPDATED, payload);

    return { flagKey, enabled };
  }
}
