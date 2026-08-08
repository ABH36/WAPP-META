import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export type ApiKeyDocument = HydratedDocument<ApiKey>;

export enum ApiKeyScope {
  READ = "READ",
  WRITE = "WRITE",
}

export enum ApiKeyStatus {
  ACTIVE = "ACTIVE",
  REVOKED = "REVOKED",
}

/**
 * PRD-006 Volume-3 §4.4/§3 — Settings owns the *record* surfaced to the
 * admin (name/prefix/status/timestamps via SettingsApiKeysController), but
 * this collection lives in Identity because verifying a presented key is
 * authentication ("§3: Identity Owns: API authentication"), the same
 * reasoning already applied to passwords and sessions. `keyHash` is bcrypt
 * (PasswordService), not TokenEncryptionService — a key, like a password, is
 * only ever verified, never read back. See
 * docs/ADR-SET-005-integration-ownership-strategy.md.
 */
@Schema({ timestamps: true, collection: "api_keys" })
export class ApiKey {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: String, required: true })
  name!: string;

  // First 8 hex chars of the raw secret — shown alongside name/status so an
  // admin can tell keys apart after the raw value is gone forever (BR-007).
  @Prop({ type: String, required: true, index: true })
  prefix!: string;

  @Prop({ type: String, required: true, select: false })
  keyHash!: string;

  @Prop({ type: String, enum: ApiKeyScope, required: true, default: ApiKeyScope.READ })
  scope!: ApiKeyScope;

  @Prop({ type: SchemaTypes.ObjectId, ref: "User", required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  lastUsedAt!: Date | null;

  @Prop({ type: Date, default: null })
  expiresAt!: Date | null;

  @Prop({ type: String, enum: ApiKeyStatus, required: true, default: ApiKeyStatus.ACTIVE })
  status!: ApiKeyStatus;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);
