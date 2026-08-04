import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { TenantRole } from "@wapp/shared-types";

export type WorkspaceInvitationDocument = HydratedDocument<WorkspaceInvitation>;

/** Only the states ever persisted — see InvitationStatus in @wapp/shared-types for the derived EXPIRED value. */
export enum PersistedInvitationStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REVOKED = "REVOKED",
}

/**
 * Traces to: PRD-002 Part 3A (Team Invitation), PRD-002 v1.1 (Invite Team
 * is optional, reordered before WhatsApp Connect), REG-BR-002/003 (unique
 * email/mobile — enforced at acceptance by delegating to
 * UserRepository.findByEmail, not duplicated here).
 *
 * One document per invite. Unlike AuthToken (Identity), this collection has
 * no TTL index — an expired-but-unaccepted invitation should still be
 * listable in the Team screen (shown as "Expired"), not silently purged.
 */
@Schema({ timestamps: true, collection: "workspace_invitations" })
export class WorkspaceInvitation {
  @Prop({ type: Types.ObjectId, ref: "Workspace", required: true, index: true })
  workspaceId!: Types.ObjectId;

  @Prop({ required: true, trim: true, lowercase: true, index: true })
  email!: string;

  @Prop({ type: String, enum: TenantRole, required: true })
  role!: TenantRole;

  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  invitedBy!: Types.ObjectId;

  // Same pattern as Identity's AuthToken — raw token only ever emailed,
  // never persisted; only its SHA-256 hash is stored.
  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({
    type: String,
    enum: PersistedInvitationStatus,
    default: PersistedInvitationStatus.PENDING,
  })
  status!: PersistedInvitationStatus;

  @Prop({ type: Date, default: null })
  acceptedAt!: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const WorkspaceInvitationSchema = SchemaFactory.createForClass(WorkspaceInvitation);
