import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type SupportTicketDocument = HydratedDocument<SupportTicket>;

/** §4.6. */
export enum SupportTicketStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  WAITING_CUSTOMER = "WAITING_CUSTOMER",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

/** §10. */
export enum SupportTicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

/**
 * §4.6 names Workspace/Category/Priority/Status/Assigned Operator/
 * Resolution as the fields; §10 separately requires Title. No fixed
 * category list is given in the document — resolved as a small, generic
 * taxonomy (engineering judgment, same footing as Volume-1's
 * AnnouncementTargetType) rather than a free-text field, so Support
 * Managers can filter/report by category later. See
 * docs/ADR-PLAT-004-support-ticket-lifecycle-strategy.md.
 */
export enum SupportTicketCategory {
  BILLING = "BILLING",
  TECHNICAL = "TECHNICAL",
  ACCOUNT = "ACCOUNT",
  FEATURE_REQUEST = "FEATURE_REQUEST",
  OTHER = "OTHER",
}

/**
 * PRD-007 Volume-2 §4.6 — platform-owned, operational only (BR-005: never
 * modifies Billing/CRM/Workspace entities directly, so this schema carries
 * no relationship into those collections beyond the plain `workspaceId`
 * string it's about). Deliberately no update/delete on Resolution outside
 * the service's own lifecycle methods — see SupportTicketService.
 */
@Schema({ timestamps: true, collection: "support_tickets" })
export class SupportTicket {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  title!: string;

  @Prop({ type: String, enum: SupportTicketCategory, required: true })
  category!: SupportTicketCategory;

  @Prop({ type: String, enum: SupportTicketPriority, required: true })
  priority!: SupportTicketPriority;

  @Prop({ type: String, enum: SupportTicketStatus, required: true, index: true })
  status!: SupportTicketStatus;

  // A platformUserId (PlatformUser, not tenant User) — nullable, unassigned by default.
  @Prop({ type: String, default: null })
  assignedOperator!: string | null;

  @Prop({ type: String, default: null })
  resolution!: string | null;

  @Prop({ type: String, required: true })
  createdBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);
