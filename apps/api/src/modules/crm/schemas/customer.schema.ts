import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";
import { CustomerSource, CustomerStatus } from "@wapp/shared-types";

export type CustomerDocument = HydratedDocument<Customer>;

/**
 * Traces to: PRD-004 Volume-1 (Customer Management). The canonical business
 * record for a Workspace's customer relationship — CRM owns this, never
 * Communication (see docs/ADR-CRM-001-customer-identity-strategy.md).
 *
 * Every Customer references exactly one Contact (§9) — Contact stays
 * Communication-owned (ADR-COMM-002); Customer never stores WhatsApp-specific
 * metadata (waProfileName, message history, etc.), only the CRM business
 * profile fields §8 actually lists.
 */
@Schema({ timestamps: true, collection: "customers" })
export class Customer {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: "Contact", required: true })
  contactId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  customerName!: string;

  // Immutable after creation (PRD-004 Volume-1, resolved 2026-08-06) — this
  // is how the Contact link was established; editing it would desync the
  // Customer from the Contact identity it references. See
  // docs/ADR-CRM-001-customer-identity-strategy.md.
  @Prop({ required: true, index: true })
  mobileNumber!: string;

  @Prop({ type: String, enum: CustomerStatus, required: true, index: true })
  status!: CustomerStatus;

  // Immutable after creation (§6/BR-007) — derived once from which creation
  // method was used, never user-editable afterward.
  @Prop({ type: String, enum: CustomerSource, required: true })
  source!: CustomerSource;

  @Prop({ type: String, default: null })
  companyName!: string | null;

  @Prop({ type: String, default: null })
  email!: string | null;

  @Prop({ type: String, default: null })
  gstNumber!: string | null;

  @Prop({ type: String, default: null })
  address!: string | null;

  @Prop({ type: String, default: null })
  city!: string | null;

  @Prop({ type: String, default: null })
  state!: string | null;

  @Prop({ type: String, default: null })
  country!: string | null;

  @Prop({ type: String, default: null })
  postalCode!: string | null;

  @Prop({ type: String, default: null })
  website!: string | null;

  @Prop({ type: String, default: null })
  industry!: string | null;

  @Prop({ type: String, default: null })
  notes!: string | null;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);

// BR-006/§10 — Mobile Number uniqueness enforced inside a Workspace, not
// across Workspaces (Tenant Isolation, §10). Enforced via the Contact
// relationship (a Contact is unique per (workspaceId, phoneNumber) already —
// ADR-COMM-002/BDC-013), not duplicated as a separate value the two records
// could drift out of sync on: one Customer per Contact per Workspace.
CustomerSchema.index({ workspaceId: 1, contactId: 1 }, { unique: true });

// §12 search field + §14 sort-by-mobile-number support.
CustomerSchema.index({ workspaceId: 1, mobileNumber: 1 });

// §13 filters + §14 sorting — the two real list-query shapes Customer
// Management needs (status/source filtering, newest/updated-first sorting).
CustomerSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
CustomerSchema.index({ workspaceId: 1, source: 1 });
