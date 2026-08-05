import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export type BroadcastRecipientDocument = HydratedDocument<BroadcastRecipient>;

export enum BroadcastRecipientStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
}

/**
 * One row per (Broadcast, Contact) — the actual per-recipient fan-out
 * ledger a Broadcast document deliberately doesn't embed (see
 * broadcast.schema.ts). `messageId` links to the real Message once sent,
 * so delivery/read status is read from the existing Message state machine
 * (docs/COMM-MESSAGE-STATE-MACHINE.md) rather than duplicated here — this
 * collection only tracks *send attempt* outcome, not delivery/read.
 */
@Schema({ timestamps: true, collection: "broadcast_recipients" })
export class BroadcastRecipient {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: "Broadcast", required: true, index: true })
  broadcastId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: "Contact", required: true })
  contactId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: BroadcastRecipientStatus,
    required: true,
    default: BroadcastRecipientStatus.PENDING,
  })
  status!: BroadcastRecipientStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: "Message", default: null })
  messageId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  errorDetail!: string | null;

  @Prop({ type: Date, default: null })
  sentAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const BroadcastRecipientSchema = SchemaFactory.createForClass(BroadcastRecipient);

BroadcastRecipientSchema.index({ broadcastId: 1, status: 1 });
// One recipient row per Contact per Broadcast — the same Contact can't be
// double-enrolled in one Broadcast (targetContactIds is deduplicated at
// creation, this index is the hard backstop).
BroadcastRecipientSchema.index({ broadcastId: 1, contactId: 1 }, { unique: true });
