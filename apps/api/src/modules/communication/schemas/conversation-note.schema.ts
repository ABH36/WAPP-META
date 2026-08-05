import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ConversationNoteDocument = HydratedDocument<ConversationNote>;

/**
 * Internal Notes on a Conversation (PRD-003 Part 2 Module B). Per
 * ADR-COMM-002's precedent for Contact vs. Customer: this is a minimal,
 * Communication-owned record, not the eventual CRM Notes entity. ADR-012
 * already confirmed CRM Notes and Communication Internal Notes are "the same
 * underlying feature, different context, no duplicate module being built" —
 * when CRM exists, it's expected to reference/absorb these the same way it
 * will absorb Contact, not duplicate the concept.
 */
@Schema({ timestamps: true, collection: "conversation_notes" })
export class ConversationNote {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: Types.ObjectId, ref: "Conversation", required: true, index: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  authorUserId!: string;

  @Prop({ type: String, required: true })
  text!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ConversationNoteSchema = SchemaFactory.createForClass(ConversationNote);
