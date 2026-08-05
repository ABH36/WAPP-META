import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export type WhatsAppConnectionDocument = HydratedDocument<WhatsAppConnection>;

export enum WhatsAppConnectionStatus {
  CONNECTED = "CONNECTED",
  DISCONNECTED = "DISCONNECTED",
  ERROR = "ERROR",
}

/**
 * Traces to: PRD-003 Part 1 (Meta Integration), D004 (every customer owns
 * their own Meta Business Account/WABA/phone number — WAPP is a Tech
 * Provider, never a BSP reseller. WAPP's own Meta App is only the vehicle
 * for Embedded Signup; this collection stores the *result* of a customer
 * connecting their own WABA to their own Workspace, one per Workspace for
 * Phase-1 (WA-BR-003 — only Owner/Admin may connect).
 *
 * `accessTokenEncrypted` is a System User access token scoped to the
 * customer's WABA, obtained via the Embedded Signup code exchange. Never
 * stored in plaintext (TAD-001 SEC-007) — see TokenEncryptionService.
 */
@Schema({ timestamps: true, collection: "whatsapp_connections" })
export class WhatsAppConnection {
  @Prop({ type: String, required: true, unique: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, unique: true, index: true })
  wabaId!: string;

  @Prop({ type: String, default: null })
  businessName!: string | null;

  @Prop({ required: true })
  accessTokenEncrypted!: string;

  @Prop({
    type: String,
    enum: WhatsAppConnectionStatus,
    default: WhatsAppConnectionStatus.CONNECTED,
  })
  status!: WhatsAppConnectionStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: "User", required: true })
  connectedBy!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  lastErrorAt!: Date | null;

  @Prop({ type: String, default: null })
  lastError!: string | null;

  @Prop({ default: false })
  isDeleted!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const WhatsAppConnectionSchema = SchemaFactory.createForClass(WhatsAppConnection);
