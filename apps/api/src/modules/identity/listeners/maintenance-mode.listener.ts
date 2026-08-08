import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  MaintenanceModeDisabledPayload,
  MaintenanceModeEnabledPayload,
} from "../../../common/events/domain-events.js";
import { WorkspaceMaintenanceStateRepository } from "../repositories/workspace-maintenance-state.repository.js";

/** Keeps Identity's local maintenance-mode read model in sync with Settings' config — see docs/ADR-SET-008-maintenance-mode-strategy.md. */
@Injectable()
export class MaintenanceModeListener {
  constructor(private readonly maintenanceStateRepository: WorkspaceMaintenanceStateRepository) {}

  @OnEvent(DomainEvent.MAINTENANCE_MODE_ENABLED)
  async onEnabled(payload: MaintenanceModeEnabledPayload): Promise<void> {
    await this.maintenanceStateRepository.setMaintenanceMode(payload.workspaceId, true);
  }

  @OnEvent(DomainEvent.MAINTENANCE_MODE_DISABLED)
  async onDisabled(payload: MaintenanceModeDisabledPayload): Promise<void> {
    await this.maintenanceStateRepository.setMaintenanceMode(payload.workspaceId, false);
  }
}
