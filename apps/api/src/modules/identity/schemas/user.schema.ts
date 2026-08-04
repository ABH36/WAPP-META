import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { TenantRole } from "@wapp/shared-types";

export type UserDocument = HydratedDocument<User>;

/**
 * Traces to: PRD-002 v1.1 (Registration/Login), REG-BR-002 (unique email),
 * REG-BR-003 (unique mobile), LOGIN-BR-001 (only verified accounts may login).
 *
 * `workspaceId` / `role` are nullable by design — a User exists the moment
 * registration completes, before any Workspace does (the approved onboarding
 * order is Register → Verify Email → Create Workspace, not atomic). The
 * Workspace module is responsible for populating both fields once the user
 * either creates a Workspace (becomes OWNER) or accepts a Team Invitation
 * (becomes the invited role). Phase-1 is strictly one User → one Workspace
 * (PRD-002 v1.1), so a single nullable field is correct — do not model this
 * as an array/membership collection without a new Business Decision.
 *
 * This collection is intentionally NOT a TenantOwnedEntity (no `workspaceId`
 * requirement at write time) — identity is platform-global; the workspace
 * link is an attribute of the user, not an isolation boundary the user
 * itself lives inside.
 */
@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ required: true, trim: true, lowercase: true, unique: true, index: true })
  email!: string;

  @Prop({ required: true, trim: true, unique: true, index: true })
  mobileNumber!: string;

  // Never selected by default (select: false) — every read path that needs it
  // must opt in explicitly via .select("+passwordHash"), preventing accidental
  // leakage through a stray `res.json(user)` (TAD-001 SEC-015 Output Sanitization).
  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ type: String, default: null })
  workspaceId!: string | null;

  @Prop({ type: String, enum: TenantRole, default: null })
  role!: TenantRole | null;

  @Prop({ default: false })
  isEmailVerified!: boolean;

  // Identity-level account kill switch (platform-level disable, e.g. fraud
  // response) — distinct from the still-undefined Workspace-Member status
  // lifecycle (Pending/Active/Suspended/Removed/Inactive), which belongs to
  // the future Workspace/Team module per the PRD-002 review's open item #12.
  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  failedLoginAttempts!: number;

  @Prop({ type: Date, default: null })
  lockedUntil!: Date | null;

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null;

  @Prop({ type: String, default: null })
  createdBy!: string | null;

  @Prop({ type: String, default: null })
  updatedBy!: string | null;

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  @Prop({ type: String, default: null })
  deletedBy!: string | null;

  // Populated automatically by { timestamps: true } — declared here only so
  // TypeScript knows about them (Mongoose adds them at runtime regardless).
  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
