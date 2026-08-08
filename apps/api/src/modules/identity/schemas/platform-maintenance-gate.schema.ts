import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type PlatformMaintenanceGateDocument = HydratedDocument<PlatformMaintenanceGate>;

/** Fixed singleton key — there is exactly one platform-wide maintenance state, never one per workspace. */
export const PLATFORM_MAINTENANCE_GATE_SINGLETON_KEY = "singleton";

/**
 * PRD-007 Volume-1 §4.7 — Identity's local read model of Platform
 * Administration's platform-wide Maintenance toggle, kept in sync via
 * `PlatformMaintenanceGateListener`'s `@OnEvent(PLATFORM_MAINTENANCE_
 * ENABLED/DISABLED)` handlers (Identity cannot depend on Platform — same
 * one-directional dependency graph as `WorkspaceMaintenanceState`,
 * ADR-SET-008). Deliberately a separate collection from
 * `WorkspaceMaintenanceState`, which is keyed per-workspace — this is a
 * true singleton with no `workspaceId` at all.
 */
@Schema({ timestamps: true, collection: "platform_maintenance_gate" })
export class PlatformMaintenanceGate {
  @Prop({
    type: String,
    required: true,
    unique: true,
    default: PLATFORM_MAINTENANCE_GATE_SINGLETON_KEY,
  })
  key!: string;

  @Prop({ type: Boolean, default: false })
  enabled!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PlatformMaintenanceGateSchema = SchemaFactory.createForClass(PlatformMaintenanceGate);
