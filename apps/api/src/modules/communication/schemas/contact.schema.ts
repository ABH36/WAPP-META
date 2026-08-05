import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ContactDocument = HydratedDocument<Contact>;

/**
 * Traces to: ADR-007 (phone number is the Phase-1 master identifier),
 * PRD-003 Part 1 (Contact Sync). Deliberately minimal — this is NOT the
 * CRM Customer entity (PRD-004), which doesn't exist yet in the approved
 * module order (Communication precedes CRM). Resolved 2026-08-05: Contact
 * is a Communication-owned, standalone identity record; when CRM (Phase 5)
 * introduces Customer, it references/absorbs Contact rather than
 * duplicating phone-number storage — that's where ADR-007's full
 * Lead/Customer dedup rule actually closes. Until then, Contact exists
 * purely to give an inbound/outbound message someone to belong to.
 */
@Schema({ timestamps: true, collection: "contacts" })
export class Contact {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, index: true })
  phoneNumber!: string;

  // WhatsApp's own profile display name — self-reported by the contact,
  // can change at any time, never treated as a verified identity field.
  @Prop({ type: String, default: null })
  waProfileName!: string | null;

  @Prop({ required: true })
  firstSeenAt!: Date;

  @Prop({ required: true })
  lastSeenAt!: Date;

  @Prop({ default: false })
  isDeleted!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);

// BDC-013 — one Contact per (workspaceId, phoneNumber); the dedup rule
// this whole schema exists to enforce.
ContactSchema.index({ workspaceId: 1, phoneNumber: 1 }, { unique: true });
