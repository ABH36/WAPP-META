import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type PlatformMaintenanceStateDocument = HydratedDocument<PlatformMaintenanceState>;

/** Fixed singleton key — there is exactly one platform-wide maintenance state. */
export const PLATFORM_MAINTENANCE_STATE_SINGLETON_KEY = "singleton";

/**
 * PRD-007 Volume-1 §4.7 — Platform Administration's own source of truth for
 * the platform-wide Maintenance toggle. `PLATFORM_MAINTENANCE_ENABLED/
 * DISABLED` events (emitted on every write here) keep Identity's separate
 * `PlatformMaintenanceGate` read model in sync — this collection is the
 * origin, that one is the downstream copy.
 */
@Schema({ timestamps: true, collection: "platform_maintenance_state" })
export class PlatformMaintenanceState {
  @Prop({
    type: String,
    required: true,
    unique: true,
    default: PLATFORM_MAINTENANCE_STATE_SINGLETON_KEY,
  })
  key!: string;

  @Prop({ type: Boolean, default: false })
  enabled!: boolean;

  @Prop({ type: String, default: null })
  reason!: string | null;

  @Prop({ type: String, default: null })
  updatedBy!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PlatformMaintenanceStateSchema =
  SchemaFactory.createForClass(PlatformMaintenanceState);
