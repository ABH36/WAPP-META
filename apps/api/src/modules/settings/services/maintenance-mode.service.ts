import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WorkspaceSettingsRepository } from "../repositories/workspace-settings.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  MaintenanceModeDisabledPayload,
  MaintenanceModeEnabledPayload,
} from "../../../common/events/domain-events.js";

/**
 * PRD-006 Volume-4 §4.6 — Settings owns the config; emits
 * MAINTENANCE_MODE_ENABLED/DISABLED so Identity's login-time read model
 * stays in sync via event consumption, never a live cross-module call
 * (see docs/ADR-SET-008-maintenance-mode-strategy.md).
 */
@Injectable()
export class MaintenanceModeService {
  constructor(
    private readonly workspaceSettingsRepository: WorkspaceSettingsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async setEnabled(workspaceId: string, actorId: string, enabled: boolean): Promise<boolean> {
    const settings = await this.workspaceSettingsRepository.updateMaintenanceMode(
      workspaceId,
      enabled,
    );

    const occurredAt = new Date().toISOString();
    if (enabled) {
      this.eventEmitter.emit(DomainEvent.MAINTENANCE_MODE_ENABLED, {
        workspaceId,
        actorId,
        occurredAt,
      } satisfies MaintenanceModeEnabledPayload);
    } else {
      this.eventEmitter.emit(DomainEvent.MAINTENANCE_MODE_DISABLED, {
        workspaceId,
        actorId,
        occurredAt,
      } satisfies MaintenanceModeDisabledPayload);
    }

    return settings.maintenanceMode;
  }
}
