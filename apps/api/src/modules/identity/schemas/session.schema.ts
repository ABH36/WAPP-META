import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export type SessionDocument = HydratedDocument<Session>;

/**
 * One document per issued refresh token ("session"/device) — backs the
 * Session Management step of the Identity module. A refresh token is a
 * signed JWT (see TokenService), but signature validity alone can't express
 * revocation ("log out this device", "log out everywhere") or detect theft —
 * this collection is the source of truth for whether a given refresh token
 * (`jti`) is still usable.
 *
 * Rotation + reuse detection (AuthService.refresh): each successful refresh
 * revokes the presented session and links it to the newly-issued one via
 * `replacedByJti`, forming a chain. If a *revoked* jti is ever presented
 * again, that's evidence of a stolen/replayed refresh token — the entire
 * chain (all sessions for that user) is revoked in response.
 *
 * `expiresAt` carries a TTL index so expired sessions are purged automatically.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "sessions" })
export class Session {
  @Prop({ type: SchemaTypes.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

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

  // Populated automatically by { timestamps: { createdAt: true } }.
  createdAt!: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
