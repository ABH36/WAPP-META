import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { PlatformRole } from "@wapp/shared-types";

export type PlatformUserDocument = HydratedDocument<PlatformUser>;

/**
 * PRD-007 Volume-1 §6 — completely separate from the tenant `User`
 * collection (Identity), a genuinely independent identity boundary, not a
 * `workspaceId: null` variant of the existing one. Platform staff are
 * provisioned directly by a PLATFORM_SUPER_ADMIN (§4.3) — no self-service
 * registration, no email-verification flow (an internal WAPP employee
 * account is created by someone who already vouches for that inbox), no
 * password-reset self-service in this volume. See
 * docs/ADR-PLAT-002-platform-identity-strategy.md.
 */
@Schema({ timestamps: true, collection: "platform_users" })
export class PlatformUser {
  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ type: String, enum: PlatformRole, required: true })
  role!: PlatformRole;

  @Prop({ default: true })
  isActive!: boolean;

  // PHD-001 Volume-1 (Security Hardening) — parity with the tenant `User`
  // collection's own account-lockout fields (`registerFailedLogin`'s exact
  // pattern, `apps/api/src/modules/identity/repositories/user.repository.ts`).
  // Previously absent entirely — Platform Admin login relied on rate
  // limiting alone, a real asymmetry given these are the highest-privilege
  // accounts in the system.
  @Prop({ default: 0 })
  failedLoginAttempts!: number;

  @Prop({ type: Date, default: null })
  lockedUntil!: Date | null;

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PlatformUserSchema = SchemaFactory.createForClass(PlatformUser);
