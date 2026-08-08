import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type RetentionPolicyDocument = HydratedDocument<RetentionPolicy>;

export const RETENTION_MIN_DAYS = 30;
export const RETENTION_MAX_DAYS = 3650;
const DEFAULT_RETENTION_DAYS = 365;

/**
 * PRD-006 Volume-4 §4.4 — BR-007: "Retention policies affect future
 * cleanup only," never immediate deletion (`RetentionCleanupProcessor`
 * sweeps on its own schedule, not synchronously on save).
 * `notificationHistoryRetentionDays` is stored even though no Notification
 * module exists yet to own that data — the field is additive/forward
 * -compatible, same anticipatory pattern ADR-027 already used for
 * Language; its cleanup is a documented no-op until Notification exists
 * (TD-020).
 */
@Schema({ timestamps: true, collection: "retention_policies" })
export class RetentionPolicy {
  @Prop({ type: String, required: true, unique: true })
  workspaceId!: string;

  @Prop({
    type: Number,
    required: true,
    default: DEFAULT_RETENTION_DAYS,
    min: RETENTION_MIN_DAYS,
    max: RETENTION_MAX_DAYS,
  })
  auditLogRetentionDays!: number;

  @Prop({
    type: Number,
    required: true,
    default: DEFAULT_RETENTION_DAYS,
    min: RETENTION_MIN_DAYS,
    max: RETENTION_MAX_DAYS,
  })
  loginHistoryRetentionDays!: number;

  @Prop({
    type: Number,
    required: true,
    default: DEFAULT_RETENTION_DAYS,
    min: RETENTION_MIN_DAYS,
    max: RETENTION_MAX_DAYS,
  })
  notificationHistoryRetentionDays!: number;

  @Prop({
    type: Number,
    required: true,
    default: DEFAULT_RETENTION_DAYS,
    min: RETENTION_MIN_DAYS,
    max: RETENTION_MAX_DAYS,
  })
  webhookDeliveryLogRetentionDays!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const RetentionPolicySchema = SchemaFactory.createForClass(RetentionPolicy);
