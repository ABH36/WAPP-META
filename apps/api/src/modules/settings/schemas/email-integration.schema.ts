import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { IntegrationConnectionStatus } from "./integration-status.enum.js";

export type EmailIntegrationConfigDocument = HydratedDocument<EmailIntegrationConfig>;

export enum EmailProvider {
  SMTP = "SMTP",
  MICROSOFT_365 = "MICROSOFT_365",
  GOOGLE_WORKSPACE = "GOOGLE_WORKSPACE",
}

export enum EmailEncryption {
  NONE = "NONE",
  SSL = "SSL",
  TLS = "TLS",
}

/**
 * PRD-006 Volume-3 §4.2 — configuration + connection-validation only
 * (BR-001/BR-005). The existing global Resend send pipeline
 * (infrastructure/email/) is untouched by this volume; wiring a workspace's
 * own configured provider into real outbound sending is a deliberately
 * separate, larger initiative — see
 * docs/ADR-SET-005-integration-ownership-strategy.md. `credentialEncrypted`
 * uses TokenEncryptionService (read back for the Test Connection handshake),
 * not bcrypt — this value must be reversible, unlike a password or API key.
 */
@Schema({ timestamps: true, collection: "email_integration_configs" })
export class EmailIntegrationConfig {
  @Prop({ type: String, required: true, unique: true, index: true })
  workspaceId!: string;

  @Prop({ type: String, enum: EmailProvider, required: true })
  provider!: EmailProvider;

  @Prop({ required: true })
  host!: string;

  @Prop({ type: Number, required: true })
  port!: number;

  @Prop({ required: true })
  username!: string;

  @Prop({ type: String, required: true, select: false })
  credentialEncrypted!: string;

  @Prop({
    type: String,
    enum: EmailEncryption,
    required: true,
    default: EmailEncryption.TLS,
  })
  encryption!: EmailEncryption;

  @Prop({ required: true })
  fromAddress!: string;

  @Prop({
    type: String,
    enum: IntegrationConnectionStatus,
    required: true,
    default: IntegrationConnectionStatus.DISCONNECTED,
  })
  status!: IntegrationConnectionStatus;

  @Prop({ type: Date, default: null })
  lastTestedAt!: Date | null;

  @Prop({ type: String, default: null })
  lastError!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const EmailIntegrationConfigSchema = SchemaFactory.createForClass(EmailIntegrationConfig);
