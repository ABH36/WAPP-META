import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  WorkspaceArchivedPayload,
  WorkspaceReactivatedPayload,
  WorkspaceSuspendedPayload,
} from "../../../common/events/domain-events.js";
import { WorkspaceMaintenanceStateRepository } from "../repositories/workspace-maintenance-state.repository.js";

/**
 * PRD-007 Volume-1 §4.1 — keeps Identity's local login-gate read model in
 * sync with Platform Administration's Suspend/Reactivate/Archive actions,
 * the same event-driven decoupling `MaintenanceModeListener` already
 * established (no reverse dependency: Identity is the most upstream
 * module, Platform depends on it, never the other way). See
 * docs/ADR-PLAT-001-platform-administration-boundary.md.
 */
@Injectable()
export class WorkspaceStatusGateListener {
  constructor(private readonly maintenanceStateRepository: WorkspaceMaintenanceStateRepository) {}

  @OnEvent(DomainEvent.WORKSPACE_SUSPENDED)
  async onSuspended(payload: WorkspaceSuspendedPayload): Promise<void> {
    await this.maintenanceStateRepository.setLoginBlocked(payload.workspaceId, true);
  }

  @OnEvent(DomainEvent.WORKSPACE_REACTIVATED)
  async onReactivated(payload: WorkspaceReactivatedPayload): Promise<void> {
    await this.maintenanceStateRepository.setLoginBlocked(payload.workspaceId, false);
  }

  @OnEvent(DomainEvent.WORKSPACE_ARCHIVED)
  async onArchived(payload: WorkspaceArchivedPayload): Promise<void> {
    await this.maintenanceStateRepository.setLoginBlocked(payload.workspaceId, true);
  }
}
