import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type WorkspaceUsageDocument = HydratedDocument<WorkspaceUsage>;

/**
 * Traces to: PRD-005 Volume-3 §6/§8/§9. One document per Workspace (not one
 * per counter) — simpler to read/increment atomically than a
 * (workspaceId, counterType) collection. Counters are monotonically
 * increasing (resolved during implementation, 2026-08-07): incremented only
 * on the resource's creation-time domain event, never decremented on
 * archive/delete — §9 frames enforcement entirely around blocking new
 * creation ("Reject new resource creation"), never around reclaiming room
 * via deletion, and archived CRM records are explicitly meant to stay
 * historical (BR-004), not be treated as "freed" capacity. See
 * docs/ADR-BILL-007-usage-counter-strategy.md.
 *
 * campaigns/storage/apiRequests counts exist for schema completeness (§6
 * lists 9 counters) but stay 0 forever in this volume — no
 * UsageCounterListener handler increments them (TD-013: no
 * CAMPAIGN_CREATED/STARTED event exists in Communication's catalog; Storage
 * uploads bypass the API entirely, SEC-016; API Requests has no commercial
 * per-workspace counter, only the technical ThrottlerModule).
 *
 * *LastThresholdNotified/*Locked exist only for the 6 counters that are
 * actually wired — idempotency state for USAGE_THRESHOLD_REACHED (don't
 * re-notify the same crossed threshold) and WORKSPACE_LOCKED/UNLOCKED
 * (don't re-emit while already in that state).
 */
@Schema({ timestamps: true, collection: "workspace_usage" })
export class WorkspaceUsage {
  @Prop({ type: String, required: true, unique: true })
  workspaceId!: string;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  teamMembersCount!: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  customersCount!: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  leadsCount!: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  dealsCount!: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  broadcastsCount!: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  campaignsCount!: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  messagesCount!: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  storageCount!: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  apiRequestsCount!: number;

  @Prop({ type: Number, default: null })
  teamMembersLastThresholdNotified!: number | null;

  @Prop({ type: Number, default: null })
  customersLastThresholdNotified!: number | null;

  @Prop({ type: Number, default: null })
  leadsLastThresholdNotified!: number | null;

  @Prop({ type: Number, default: null })
  dealsLastThresholdNotified!: number | null;

  @Prop({ type: Number, default: null })
  broadcastsLastThresholdNotified!: number | null;

  @Prop({ type: Number, default: null })
  messagesLastThresholdNotified!: number | null;

  @Prop({ type: Boolean, required: true, default: false })
  teamMembersLocked!: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  customersLocked!: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  leadsLocked!: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  dealsLocked!: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  broadcastsLocked!: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  messagesLocked!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const WorkspaceUsageSchema = SchemaFactory.createForClass(WorkspaceUsage);
