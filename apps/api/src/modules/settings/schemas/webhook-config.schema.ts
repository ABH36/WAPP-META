import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { WebhookEventType } from "@wapp/shared-types";
import { IntegrationConnectionStatus } from "./integration-status.enum.js";

export type WebhookConfigDocument = HydratedDocument<WebhookConfig>;

export const WEBHOOK_MIN_RETRY_COUNT = 0;
export const WEBHOOK_MAX_RETRY_COUNT = 10;
export const WEBHOOK_MIN_TIMEOUT_SECONDS = 5;
export const WEBHOOK_MAX_TIMEOUT_SECONDS = 60;

/**
 * PRD-006 Volume-3 §4.3 — a Workspace may configure multiple webhooks (no
 * one-per-workspace rule stated, unlike WhatsApp's BR-006), each subscribed
 * to a subset of `events`. `secretEncrypted` (TokenEncryptionService, read
 * back to HMAC-sign each delivery) is never returned through the API
 * (BR-002). §10 validation (HTTPS-only URL, retry 0-10, timeout 5-60s) is
 * enforced at the DTO layer, not just these schema bounds.
 */
@Schema({ timestamps: true, collection: "webhook_configs" })
export class WebhookConfig {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true })
  url!: string;

  @Prop({ type: String, required: true, select: false })
  secretEncrypted!: string;

  @Prop({ type: Boolean, required: true, default: true })
  enabled!: boolean;

  @Prop({
    type: Number,
    required: true,
    default: 3,
    min: WEBHOOK_MIN_RETRY_COUNT,
    max: WEBHOOK_MAX_RETRY_COUNT,
  })
  retryCount!: number;

  @Prop({
    type: Number,
    required: true,
    default: 30,
    min: WEBHOOK_MIN_TIMEOUT_SECONDS,
    max: WEBHOOK_MAX_TIMEOUT_SECONDS,
  })
  timeoutSeconds!: number;

  @Prop({ type: [String], enum: WebhookEventType, required: true })
  events!: WebhookEventType[];

  @Prop({
    type: String,
    enum: IntegrationConnectionStatus,
    required: true,
    default: IntegrationConnectionStatus.CONNECTED,
  })
  status!: IntegrationConnectionStatus;

  @Prop({ type: Date, default: null })
  lastDeliveryAt!: Date | null;

  @Prop({ type: String, default: null })
  lastError!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const WebhookConfigSchema = SchemaFactory.createForClass(WebhookConfig);
