import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type MessageDocument = HydratedDocument<Message>;

export enum MessageDirection {
  INBOUND = "INBOUND",
  OUTBOUND = "OUTBOUND",
}

/** Meta's message `type` values this module recognizes structurally; anything else is stored via `rawPayload`. */
export enum MessageType {
  TEXT = "TEXT",
  IMAGE = "IMAGE",
  DOCUMENT = "DOCUMENT",
  AUDIO = "AUDIO",
  VIDEO = "VIDEO",
  STICKER = "STICKER",
  LOCATION = "LOCATION",
  CONTACTS = "CONTACTS",
  INTERACTIVE = "INTERACTIVE",
  UNKNOWN = "UNKNOWN",
}

/**
 * The canonical Message state machine (docs/COMM-MESSAGE-STATE-MACHINE.md)
 * — Outbound: QUEUED -> SENT -> DELIVERED -> READ (or -> FAILED at any
 * point before DELIVERED). Inbound: RECEIVED -> PROCESSED -> VISIBLE.
 *
 * PROCESSED and VISIBLE are reserved by Part-1, not yet transitioned to —
 * every inbound message currently stops at RECEIVED (see WebhookService).
 * PROCESSED depends on business rules (dedup/automation) that don't exist
 * until Part 4; VISIBLE depends on the Shared Inbox/Conversation entity
 * that doesn't exist until Part 2. Defining the values now, before their
 * producers exist, is the same pattern already used for the domain event
 * catalog — the state machine is the contract Part 2/4 build against.
 */
export enum MessageStatus {
  QUEUED = "QUEUED",
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  READ = "READ",
  FAILED = "FAILED",
  RECEIVED = "RECEIVED",
  PROCESSED = "PROCESSED",
  VISIBLE = "VISIBLE",
}

/**
 * Traces to: PRD-003 Part 1 (Core Messaging Engine). Deliberately scoped to
 * message send/receive/status only — no Conversation lifecycle entity
 * (status, assignment, SLA) here; that's Shared Team Inbox (PRD-003 Part
 * 2), a later, separate slice. A "conversation" for Part-1's purposes is
 * just "every Message for one Contact on one PhoneNumber," queryable
 * without a dedicated grouping record.
 *
 * Only TEXT messages are fully modeled in `content` for Part-1 (the only
 * outbound type this slice sends). Other inbound types are recorded with
 * their Meta `type` and the full original payload in `rawPayload`, so no
 * data is lost even though this slice doesn't process media — closing that
 * gap (download/store to Cloudinary, captions, etc.) is later scope.
 */
@Schema({ timestamps: true, collection: "messages" })
export class Message {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: Types.ObjectId, ref: "PhoneNumber", required: true, index: true })
  phoneNumberId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Contact", required: true, index: true })
  contactId!: Types.ObjectId;

  @Prop({ type: String, enum: MessageDirection, required: true })
  direction!: MessageDirection;

  @Prop({ type: String, enum: MessageType, required: true })
  type!: MessageType;

  @Prop({ type: String, default: null })
  text!: string | null;

  // Full original Meta payload for this message/status entry — always
  // stored, regardless of type, so nothing is silently dropped.
  @Prop({ type: Object, required: true })
  rawPayload!: Record<string, unknown>;

  // Meta's message id (the "wamid...." string) — unique, and the basis for
  // idempotent webhook processing (duplicate delivery must not duplicate
  // the message record).
  @Prop({ required: true, unique: true, index: true })
  waMessageId!: string;

  @Prop({ type: String, enum: MessageStatus, required: true })
  status!: MessageStatus;

  @Prop({ type: String, default: null })
  errorDetail!: string | null;

  // When Meta says the message/status event occurred (its own `timestamp`
  // field) — distinct from `createdAt` (when we persisted it).
  @Prop({ required: true })
  occurredAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
