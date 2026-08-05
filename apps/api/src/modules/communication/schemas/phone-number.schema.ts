import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export type PhoneNumberDocument = HydratedDocument<PhoneNumber>;

/** Meta's own quality rating values (Graph API `quality_rating` field). */
export enum QualityRating {
  GREEN = "GREEN",
  YELLOW = "YELLOW",
  RED = "RED",
  UNKNOWN = "UNKNOWN",
}

/**
 * Traces to: PRD-003 Part 1 Module C (Phone Number Management). One
 * customer WABA can hold multiple numbers (Module B — "based on
 * subscription"); each is synced from Meta, never created locally.
 * Quality rating and messaging limit are tracked per phone number, not per
 * WABA, matching Meta's actual data model (a WABA can hold numbers with
 * different ratings — resolves the Module B/C ownership question flagged
 * during the PRD-003 Part 1 review).
 */
@Schema({ timestamps: true, collection: "phone_numbers" })
export class PhoneNumber {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: "WhatsAppConnection", required: true, index: true })
  whatsappConnectionId!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  phoneNumberId!: string;

  @Prop({ required: true })
  displayPhoneNumber!: string;

  @Prop({ type: String, default: null })
  verifiedName!: string | null;

  @Prop({ type: String, enum: QualityRating, default: QualityRating.UNKNOWN })
  qualityRating!: QualityRating;

  // Meta's messaging tier name as returned by the Graph API (e.g.
  // "TIER_1K") — stored as-is rather than a closed enum, since Meta adds
  // new tiers over time and this is a display/reporting field, never
  // branched on for business logic in Part-1.
  @Prop({ type: String, default: null })
  messagingLimitTier!: string | null;

  @Prop({ type: Date, default: null })
  lastSyncedAt!: Date | null;

  @Prop({ default: false })
  isDeleted!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PhoneNumberSchema = SchemaFactory.createForClass(PhoneNumber);
