import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";
import { DealLostReason, DealStage } from "@wapp/shared-types";

export type DealDocument = HydratedDocument<Deal>;

/**
 * Traces to: PRD-004 Volume-3 §7 (Lead Conversion — minimal Deal creation,
 * still the only creation path — ADR-CRM-010) and PRD-004 Volume-4 (Deal
 * Management, the full field set/lifecycle owned from here on). Part-3
 * created this collection minimally on purpose specifically so Part-4 could
 * extend it in place rather than create a second one — see
 * docs/ADR-CRM-010-deal-creation-boundary.md and
 * docs/ADR-CRM-012-deal-lifecycle-strategy.md.
 */
@Schema({ timestamps: true, collection: "deals" })
export class Deal {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  // §18/BR-003 — permanent, immutable identity, same as Lead/Customer's own
  // Contact/Customer references. Never editable via UpdateDealDto.
  @Prop({ type: SchemaTypes.ObjectId, ref: "Contact", required: true })
  contactId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: "Customer", required: true, index: true })
  customerId!: Types.ObjectId;

  // §7 — "Lead remains the historical origin." Permanent, immutable
  // back-reference; the inverse of Lead.dealId. Indexed below via the
  // explicit unique index, not here (a second `index: true` would create a
  // duplicate, non-unique index alongside it).
  @Prop({ type: SchemaTypes.ObjectId, ref: "Lead", required: true })
  sourceLeadId!: Types.ObjectId;

  // §5 — carried forward from the source Lead's leadName at creation
  // (LeadConversionService), editable afterward.
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ type: String, default: null })
  description!: string | null;

  // BR-004 — never negative, enforced at the DTO layer (class-validator)
  // and again here as a schema-level backstop.
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  value!: number;

  // India-only Phase-1 (D002) — no multi-currency conversion logic: always
  // "INR" today, but kept as a field rather than hardcoded so a future
  // geography expansion doesn't need a schema migration.
  @Prop({ type: String, required: true, default: "INR" })
  currency!: string;

  // BR-005 — 0-100. Not auto-derived from stage: §9's "Expected Revenue =
  // Value × Probability" formula and BR-005's phrasing as a validation
  // constraint (not a computation rule) both read as a manually-set,
  // independently-validated field — no stage-to-percentage table is given
  // anywhere in Volume-4. Flagged as a reasoned assumption, not silently
  // decided — see docs/ADR-CRM-012-deal-lifecycle-strategy.md.
  @Prop({ type: Number, required: true, default: 0, min: 0, max: 100 })
  probability!: number;

  @Prop({ type: Date, default: null })
  expectedCloseDate!: Date | null;

  // §8/§9 — a platform User id, not a Mongoose ref, same convention
  // Lead.assignedUserId/Conversation.assignedToUserId already established.
  // Only SALES_EXECUTIVE-role members are eligible (DEAL_ELIGIBLE_ASSIGNEE_ROLES).
  // Carried forward from the source Lead's assignedUserId at creation, if any.
  @Prop({ type: String, default: null, index: true })
  assignedTo!: string | null;

  @Prop({ type: String, enum: DealStage, required: true, default: DealStage.OPEN, index: true })
  stage!: DealStage;

  // BR-006 — only ever set together with the matching terminal stage;
  // cleared on reopen. Mutually exclusive with lostAt/lostReason.
  @Prop({ type: Date, default: null })
  wonAt!: Date | null;

  @Prop({ type: Date, default: null })
  lostAt!: Date | null;

  // BR-007 — required when (and only when) stage = LOST; enforced in
  // DealService.updateStage, not at the schema level (schema can't express
  // "required conditional on a sibling field's value").
  @Prop({ type: String, enum: DealLostReason, default: null })
  lostReason!: DealLostReason | null;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const DealSchema = SchemaFactory.createForClass(Deal);

// One Deal per source Lead — BR-004/BR-007, conversion is irreversible and
// creates exactly one Deal; this is the structural backstop alongside
// Lead.dealId/convertedAt's own idempotency guard in LeadConversionService.
DealSchema.index({ sourceLeadId: 1 }, { unique: true });

DealSchema.index({ workspaceId: 1, stage: 1 });

// §13 search field.
DealSchema.index({ workspaceId: 1, title: 1 });

// §14 filters/sorting — the list-query shapes Deal Management needs.
DealSchema.index({ workspaceId: 1, assignedTo: 1, stage: 1 });
DealSchema.index({ workspaceId: 1, customerId: 1 });
DealSchema.index({ workspaceId: 1, expectedCloseDate: 1 });
