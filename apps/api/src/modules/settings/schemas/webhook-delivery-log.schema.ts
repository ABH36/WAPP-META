import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";
import { WebhookEventType } from "@wapp/shared-types";

export type WebhookDeliveryLogDocument = HydratedDocument<WebhookDeliveryLog>;

/**
 * PRD-006 Volume-3 §4.7 — one entry per delivery attempt, insert-only (same
 * immutable-audit-log shape as Identity's LoginHistoryEntry/Billing's
 * BillingHistoryEntry). Backs Integration Health's "Last Sync"/"Last Error"
 * per webhook without needing to keep a full history on WebhookConfig
 * itself.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "webhook_delivery_logs" })
export class WebhookDeliveryLog {
  @Prop({ type: SchemaTypes.ObjectId, ref: "WebhookConfig", required: true, index: true })
  webhookId!: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: String, enum: WebhookEventType, required: true })
  event!: WebhookEventType;

  @Prop({ type: Boolean, required: true })
  success!: boolean;

  @Prop({ type: Number, default: null })
  statusCode!: number | null;

  @Prop({ type: String, default: null })
  error!: string | null;

  createdAt!: Date;
}

export const WebhookDeliveryLogSchema = SchemaFactory.createForClass(WebhookDeliveryLog);
