import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export type AuthTokenDocument = HydratedDocument<AuthToken>;

export enum AuthTokenType {
  EMAIL_VERIFICATION = "EMAIL_VERIFICATION",
  PASSWORD_RESET = "PASSWORD_RESET",
}

/**
 * Single-use, short-lived tokens for email verification and password reset
 * (TAD-001 §11 AUTH-004/AUTH-005). The raw token is emailed to the user and
 * never persisted — only a SHA-256 hash is stored, so a database read alone
 * can never be used to impersonate a verification/reset link (same reasoning
 * as not storing plaintext passwords).
 *
 * `expiresAt` carries a TTL index — MongoDB automatically purges expired
 * tokens, so there is no need for a manual cleanup job.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "auth_tokens" })
export class AuthToken {
  @Prop({ type: SchemaTypes.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: AuthTokenType, required: true })
  type!: AuthTokenType;

  @Prop({ required: true })
  tokenHash!: string;

  @Prop({ required: true, expires: 0 })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  usedAt!: Date | null;

  // Populated automatically by { timestamps: { createdAt: true } }.
  createdAt!: Date;
}

export const AuthTokenSchema = SchemaFactory.createForClass(AuthToken);
