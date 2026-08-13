import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export type PlatformSessionDocument = HydratedDocument<PlatformSession>;

/**
 * PRD-007 Volume-1 — the exact same shape/rotation-and-reuse-detection
 * design as Identity's `Session`, mirrored deliberately rather than
 * reused, since Platform authentication is a genuinely separate identity
 * boundary (§6). See docs/ADR-PLAT-002-platform-identity-strategy.md.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "platform_sessions" })
export class PlatformSession {
  @Prop({ type: SchemaTypes.ObjectId, ref: "PlatformUser", required: true, index: true })
  platformUserId!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  jti!: string;

  @Prop({ required: true })
  tokenHash!: string;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  @Prop({ required: true, expires: 0 })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, default: null })
  replacedByJti!: string | null;

  // PHD-001 Volume-1 (Security Hardening) — see the tenant `Session` schema's
  // identical field for the full rationale.
  @Prop({ default: false })
  rememberMe!: boolean;

  createdAt!: Date;
}

export const PlatformSessionSchema = SchemaFactory.createForClass(PlatformSession);
