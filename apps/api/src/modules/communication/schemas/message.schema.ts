import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

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
  // Outbound-only (Part 3, MessageService.sendTemplate) — Meta never sends
  // this as an *inbound* webhook message type, it's how we record our own
  // approved-template sends locally.
  TEMPLATE = "TEMPLATE",
  UNKNOWN = "UNKNOWN",
}

/**
 * The canonical Message state machine (docs/COMM-MESSAGE-STATE-MACHINE.md)
 * — Outbound: QUEUED -> SENT -> DELIVERED -> READ (or -> FAILED at any
 * point before DELIVERED). Inbound: RECEIVED -> PROCESSED -> VISIBLE.
 *
 * Updated 2026-08-05 (Part 2): the Conversation entity now exists, so every
 * inbound message goes straight to VISIBLE at creation (see
 * WebhookService.handleInboundMessage) — RECEIVED and VISIBLE happen
 * atomically in one write since there is still no gating step between them
 * (that's what PROCESSED is reserved for). PROCESSED remains reserved,
 * genuinely not yet transitioned to — it depends on the Part 4 automation
 * engine (dedup/business-rule processing), which still doesn't exist.
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
 * Traces to: PRD-003 Part 1 (Core Messaging Engine) + Part 2 (Shared Team
 * Inbox, 2026-08-05 — added `conversationId`). Every Message now belongs to
 * exactly one Conversation (the grouping/lifecycle entity Part-1 explicitly
 * deferred), resolved/created via ConversationRepository.recordActivity at
 * the point of send/receive — see conversation-state-machine.ts.
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

  @Prop({ type: SchemaTypes.ObjectId, ref: "Conversation", required: true, index: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: "PhoneNumber", required: true, index: true })
  phoneNumberId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: "Contact", required: true, index: true })
  contactId!: Types.ObjectId;

  // Set only for a Broadcast-originated outbound send (Part 3b) — null for
  // every other Message. Lets BroadcastRecipient link back to a real
  // Message without duplicating delivery/read status locally (see
  // broadcast-recipient.schema.ts).
  @Prop({ type: SchemaTypes.ObjectId, ref: "Broadcast", default: null, index: true })
  broadcastId!: Types.ObjectId | null;

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
