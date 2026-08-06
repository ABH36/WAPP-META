import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";
import { DealStage } from "@wapp/shared-types";

export type DealDocument = HydratedDocument<Deal>;

/**
 * Traces to: PRD-004 Volume-3 §7 (Lead Conversion — minimal Deal creation).
 * Deliberately minimal — this is NOT the full Deal Management entity
 * (PRD-004 Volume-4/Part-4, not yet reviewed). Volume-3 only needs
 * something to create and reference as the conversion target; Part-4
 * extends this same `deals` collection with its full field set (pipeline
 * value, close dates, etc.) rather than creating a second one — see
 * docs/ADR-CRM-010-deal-creation-boundary.md.
 */
@Schema({ timestamps: true, collection: "deals" })
export class Deal {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

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

  // Starts at the most conservative value (NEW) — Volume-3 doesn't define
  // Deal's own pipeline-stage business rules, only that a Deal must exist;
  // Part-4 owns what happens to `stage` from here.
  @Prop({ type: String, enum: DealStage, required: true, default: DealStage.NEW })
  stage!: DealStage;

  @Prop({ type: String, required: true })
  createdBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const DealSchema = SchemaFactory.createForClass(Deal);

// One Deal per source Lead — BR-004/BR-007, conversion is irreversible and
// creates exactly one Deal; this is the structural backstop alongside
// Lead.dealId/convertedAt's own idempotency guard in LeadConversionService.
DealSchema.index({ sourceLeadId: 1 }, { unique: true });

DealSchema.index({ workspaceId: 1, stage: 1 });
