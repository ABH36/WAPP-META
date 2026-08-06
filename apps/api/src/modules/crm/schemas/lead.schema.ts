import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";
import { LeadSource, LeadStatus } from "@wapp/shared-types";
import { LEAD_ACTIVE_STATUSES } from "../crm.constants.js";

export type LeadDocument = HydratedDocument<Lead>;

/**
 * Traces to: PRD-004 Volume-2 (Lead Management). A Lead is a potential
 * business opportunity, sales-qualification-owned; Contact stays
 * Communication-owned and Customer stays Customer-Management-owned (§3) —
 * see docs/ADR-CRM-006-lead-ownership-strategy.md.
 *
 * A Lead always references a Contact and may reference a Customer (§12,
 * neither owns the other) — resolved through the same identity-resolution
 * pattern ADR-CRM-001 already established for Customer.
 */
@Schema({ timestamps: true, collection: "leads" })
export class Lead {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: "Contact", required: true, index: true })
  contactId!: Types.ObjectId;

  // §12 — optional; auto-linked at creation whenever a Customer already
  // exists for the resolved Contact (§11), or supplied directly for Method
  // 3 (Existing Customer Upsell Opportunity).
  @Prop({ type: SchemaTypes.ObjectId, ref: "Customer", default: null })
  customerId!: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  leadName!: string;

  // Immutable after creation (BR-004), mirrors the resolved Contact's
  // phoneNumber — same reasoning as Customer.mobileNumber (ADR-CRM-001).
  @Prop({ required: true, index: true })
  mobileNumber!: string;

  // Client-supplied, immutable after creation (BR-003) — see LeadSource's
  // own doc comment for why this can't be purely derived the way
  // CustomerSource is.
  @Prop({ type: String, enum: LeadSource, required: true })
  source!: LeadSource;

  @Prop({ type: String, enum: LeadStatus, required: true, index: true })
  status!: LeadStatus;

  @Prop({ type: String, default: null })
  company!: string | null;

  @Prop({ type: String, default: null })
  email!: string | null;

  @Prop({ type: String, default: null })
  industry!: string | null;

  @Prop({ type: Number, default: null })
  expectedValue!: number | null;

  @Prop({ type: String, default: null })
  notes!: string | null;

  // A platform User id, not a Mongoose ref — CRM doesn't own `users`
  // (same convention Conversation.assignedToUserId already established).
  // Optional (BR-007); only SALES_EXECUTIVE-role members are eligible
  // (§10, LEAD_ELIGIBLE_ASSIGNEE_ROLES).
  @Prop({ type: String, default: null, index: true })
  assignedUserId!: string | null;

  // §19/§17 — a separate mechanism from `status`, not an extra LeadStatus
  // value (resolved 2026-08-06, Architecture Review): a Lead can be
  // archived from any status without that being a "stage" transition. Also
  // this module's soft-delete mechanism (BR-008), same pattern Contact's
  // isDeleted already uses, not Customer's status-is-terminal approach.
  @Prop({ type: Date, default: null })
  archivedAt!: Date | null;

  // PRD-004 Volume-3 §9 — immutable conversion metadata, set exactly once
  // by LeadConversionService within its transaction. dealId/convertedAt
  // being independent of archivedAt is deliberate (§4 lists "Not Archived"
  // and "Not already converted" as two separate preconditions) — see
  // docs/ADR-CRM-009-lead-conversion-strategy.md.
  @Prop({ type: SchemaTypes.ObjectId, ref: "Deal", default: null })
  dealId!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  convertedAt!: Date | null;

  @Prop({ type: String, default: null })
  convertedBy!: string | null;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

// BR-005/§11 — duplicate active Leads for the same Contact are prohibited
// within a Workspace, but a Contact may accumulate multiple Leads over time
// once earlier ones reach a terminal status or are archived (unlike
// Customer's permanent 1:1 Contact link) — a partial unique index, not a
// plain one.
LeadSchema.index(
  { workspaceId: 1, contactId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: LEAD_ACTIVE_STATUSES }, archivedAt: null },
  },
);

// §13 search field + §14 sort-by-mobile-number support.
LeadSchema.index({ workspaceId: 1, mobileNumber: 1 });

// §14 filters/sorting — the real list-query shapes Lead Management needs.
LeadSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
LeadSchema.index({ workspaceId: 1, source: 1 });
LeadSchema.index({ workspaceId: 1, assignedUserId: 1, status: 1 });
