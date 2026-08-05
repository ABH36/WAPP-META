import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export type ConversationDocument = HydratedDocument<Conversation>;

/**
 * Traces to: PRD-003 Part 2 (Shared Team Inbox), BRD-001's approved 8-item
 * Conversation Status list, BDC-012 (Resolved -> Closed is a sequential
 * auto-close-after-inactivity relationship, not two independent terminal
 * states). Full lifecycle and transition rules: see
 * docs/COMM-CONVERSATION-STATE-MACHINE.md.
 */
export enum ConversationStatus {
  NEW = "NEW",
  OPEN = "OPEN",
  ASSIGNED = "ASSIGNED",
  PENDING = "PENDING",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
  SPAM = "SPAM",
  ARCHIVED = "ARCHIVED",
}

/**
 * Groups every Message for one Contact into a single, reopenable thread —
 * the entity Part-1's Message schema doc explicitly deferred ("no
 * Conversation lifecycle entity here; that's Shared Team Inbox, a later,
 * separate slice"). One Conversation per (workspaceId, contactId): closing
 * or resolving it doesn't fragment history into a new record — new activity
 * reopens the same Conversation (see conversation-state-machine.ts).
 *
 * Visibility: open to all workspace roles with REPLY_CONVERSATIONS access
 * (Owner/Admin/Sales Manager/Sales Executive/Support Manager/Support
 * Executive) — resolved 2026-08-05, Product Owner decision. Marketing
 * Executive has no Conversations access at all (PRD-000C v1.1 role scope),
 * enforced by the same permission, not a separate visibility rule.
 */
@Schema({ timestamps: true, collection: "conversations" })
export class Conversation {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: "Contact", required: true, index: true })
  contactId!: Types.ObjectId;

  // The WABA phone number this conversation is anchored to — needed to send
  // a reply without asking the caller to re-specify it every time.
  @Prop({ type: SchemaTypes.ObjectId, ref: "PhoneNumber", required: true })
  phoneNumberId!: Types.ObjectId;

  @Prop({ type: String, enum: ConversationStatus, required: true, index: true })
  status!: ConversationStatus;

  // A platform User id (string, matching the Identity module's convention),
  // not a Mongoose ref — Communication doesn't own the `users` collection.
  @Prop({ type: String, default: null, index: true })
  assignedToUserId!: string | null;

  @Prop({ required: true })
  lastMessageAt!: Date;

  // Distinct from lastMessageAt (any direction) — tracks the customer's own
  // last activity specifically; not consumed yet, reserved for SLA/Part 4.
  @Prop({ type: Date, default: null })
  lastCustomerMessageAt!: Date | null;

  @Prop({ type: Date, default: null })
  resolvedAt!: Date | null;

  @Prop({ type: Date, default: null })
  closedAt!: Date | null;

  // Part 4a (Automation Engine) — last time each auto-reply type was sent
  // on this Conversation. Kept separate (rather than one shared timestamp)
  // because Welcome and Away are independent triggers: firing one must not
  // block the other from firing later within the same cooldown window.
  // Each still throttles repeats of its own type — a customer sending
  // several messages in a row outside business hours doesn't get the Away
  // message repeated for every one of them.
  @Prop({ type: Date, default: null })
  welcomeLastSentAt!: Date | null;

  @Prop({ type: Date, default: null })
  awayLastSentAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// One Conversation per Contact per workspace — the dedup rule this schema
// exists to enforce, same pattern as Contact's own (workspaceId, phoneNumber)
// index (ADR-COMM-002).
ConversationSchema.index({ workspaceId: 1, contactId: 1 }, { unique: true });

// Inbox listing filters (status) and "my conversations" (assignedToUserId)
// are the two real query shapes the Shared Inbox needs.
ConversationSchema.index({ workspaceId: 1, status: 1, lastMessageAt: -1 });
ConversationSchema.index({ workspaceId: 1, assignedToUserId: 1, status: 1 });
