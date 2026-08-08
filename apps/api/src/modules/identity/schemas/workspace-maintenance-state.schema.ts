import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type WorkspaceMaintenanceStateDocument = HydratedDocument<WorkspaceMaintenanceState>;

/**
 * PRD-006 Volume-4 §4.6 — a small, Identity-owned read model of a
 * Settings-owned config value (`WorkspaceSettings.maintenanceMode`), kept
 * current via `MaintenanceModeListener` reacting to
 * `MAINTENANCE_MODE_ENABLED`/`DISABLED`. Exists so `AuthService.login()` can
 * check maintenance status with a fast local read instead of Identity
 * gaining a live dependency on Settings — the codebase's established
 * one-directional dependency graph (Settings depends on everything, nothing
 * depends on Settings) stays intact. See
 * docs/ADR-SET-008-maintenance-mode-strategy.md.
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

  updatedAt!: Date;
}

export const WorkspaceMaintenanceStateSchema =
  SchemaFactory.createForClass(WorkspaceMaintenanceState);
