import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { PlatformFeatureUpdatedPayload } from "../../../common/events/domain-events.js";
import { PlatformFeatureOverrideRepository } from "../repositories/platform-feature-override.repository.js";
import { FeatureFlagKey } from "../schemas/feature-flag-state.schema.js";

/** PRD-007 Volume-1 §4.5 — keeps Settings' local read model in sync with Platform Administration's feature-override tier. */
@Injectable()
export class PlatformFeatureOverrideListener {
  constructor(
    private readonly platformFeatureOverrideRepository: PlatformFeatureOverrideRepository,
  ) {}

  @OnEvent(DomainEvent.PLATFORM_FEATURE_UPDATED)
  async onPlatformFeatureUpdated(payload: PlatformFeatureUpdatedPayload): Promise<void> {
    await this.platformFeatureOverrideRepository.upsert(
      payload.flagKey as FeatureFlagKey,
      payload.enabled,
    );
  }
}
