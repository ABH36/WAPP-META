import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type WorkspaceMaintenanceStateDocument = HydratedDocument<WorkspaceMaintenanceState>;

/**
 * A small, Identity-owned per-workspace login-gate read model — two
 * independent flags, both checked together at the same point in
 * `AuthService.login()`, kept current via event listeners rather than a
 * live cross-module dependency (Identity is the most upstream module;
 * nothing it imports may import it back):
 *
 * - `maintenanceMode` (PRD-006 Volume-4 §4.6) mirrors Settings-owned
 *   `WorkspaceSettings.maintenanceMode`, synced by `MaintenanceModeListener`
 *   reacting to `MAINTENANCE_MODE_ENABLED`/`DISABLED`. See
 *   docs/ADR-SET-008-maintenance-mode-strategy.md.
 * - `loginBlocked` (PRD-007 Volume-1 §4.1) reflects a platform-admin
 *   Suspend/Archive action, synced by `WorkspaceStatusGateListener`
 *   reacting to `WORKSPACE_SUSPENDED`/`REACTIVATED`/`ARCHIVED`. See
 *   docs/ADR-PLAT-001-platform-administration-boundary.md.
 *
 * Kept as one collection (not two) since both are the same shape of thing —
 * a per-workspace boolean gate read once at login — rather than two
 * near-identical collections.
 */
@Schema({
  timestamps: { createdAt: false, updatedAt: true },
  collection: "workspace_maintenance_states",
})
export class WorkspaceMaintenanceState {
  @Prop({ type: String, required: true, unique: true })
  workspaceId!: string;

  @Prop({ type: Boolean, required: true, default: false })
  maintenanceMode!: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  loginBlocked!: boolean;

  updatedAt!: Date;
}

export const WorkspaceMaintenanceStateSchema =
  SchemaFactory.createForClass(WorkspaceMaintenanceState);
