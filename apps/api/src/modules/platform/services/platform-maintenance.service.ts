import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PlatformMaintenanceStateRepository } from "../repositories/platform-maintenance-state.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  PlatformMaintenanceDisabledPayload,
  PlatformMaintenanceEnabledPayload,
} from "../../../common/events/domain-events.js";

export interface PlatformMaintenanceStatus {
  enabled: boolean;
  reason: string | null;
}

/**
 * PRD-007 Volume-1 §4.7 — the platform-wide equivalent of Settings'
 * per-workspace Maintenance Mode (ADR-SET-008), extending the same
 * event-driven decoupling pattern: this service owns the source of truth
 * and emits PLATFORM_MAINTENANCE_ENABLED/DISABLED for Identity's
 * `PlatformMaintenanceGateListener` to consume, rather than a live
 * cross-module call.
 */
@Injectable()
export class PlatformMaintenanceService {
  constructor(
    private readonly platformMaintenanceStateRepository: PlatformMaintenanceStateRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getStatus(): Promise<PlatformMaintenanceStatus> {
    const state = await this.platformMaintenanceStateRepository.get();
    return { enabled: state?.enabled ?? false, reason: state?.reason ?? null };
  }

  async setEnabled(
    enabled: boolean,
    reason: string | null,
    actorId: string,
  ): Promise<PlatformMaintenanceStatus> {
    const state = await this.platformMaintenanceStateRepository.setEnabled(
      enabled,
      reason,
      actorId,
    );

    const occurredAt = new Date().toISOString();
    if (enabled) {
      const payload: PlatformMaintenanceEnabledPayload = { actorId, occurredAt };
      this.eventEmitter.emit(DomainEvent.PLATFORM_MAINTENANCE_ENABLED, payload);
    } else {
      const payload: PlatformMaintenanceDisabledPayload = { actorId, occurredAt };
      this.eventEmitter.emit(DomainEvent.PLATFORM_MAINTENANCE_DISABLED, payload);
    }

    return { enabled: state.enabled, reason: state.reason };
  }
}
