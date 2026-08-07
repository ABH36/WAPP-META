import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { BillingCycle } from "@wapp/shared-types";

export type PlanDocument = HydratedDocument<Plan>;

/**
 * Traces to: PRD-005 Volume-1 §5 (Plan Entity). Platform-global, not
 * Workspace-scoped — every Workspace chooses from the same shared catalog
 * (unlike every other schema in this codebase so far, which is always
 * workspace-scoped). Seeded with the three tiers already approved at the
 * planning stage (Starter/Growth/Enterprise, same full feature set in
 * Phase-1, differing only by usage limits — Volume-3 scope) — see
 * docs/ADR-BILL-001-subscription-ownership-strategy.md.
 *
 * monthlyPrice/yearlyPrice are nullable: commercial pricing has not been
 * formally approved via GTM pricing decision yet (2026-08-07) — seeding a
 * placeholder number (including 0, which reads as "free plan," a real
 * business meaning) would persist an unapproved commercial value. TODO:
 * set real prices once GTM pricing is approved, before production
 * deployment — tracked as TD-009 in docs/TECH-DEBT.md.
 */
@Schema({ timestamps: true, collection: "plans" })
export class Plan {
  @Prop({ required: true, trim: true, unique: true })
  name!: string;

  @Prop({ type: String, default: null })
  description!: string | null;

  @Prop({ type: Number, default: null, min: 0 })
  monthlyPrice!: number | null;

  @Prop({ type: Number, default: null, min: 0 })
  yearlyPrice!: number | null;

  // India-only Phase-1 (D002) — no multi-currency conversion logic, same
  // reasoning as Deal.currency (docs/ADR-CRM-012-deal-lifecycle-strategy.md).
  @Prop({ type: String, required: true, default: "INR" })
  currency!: string;

  // §5 lists this alongside separate monthlyPrice/yearlyPrice fields — kept
  // as a nullable default-cycle hint (not a hard constraint on which cycle a
  // Subscription may choose; every Plan carries both price points and
  // supports either cycle) rather than silently dropped, since it's a
  // relayed field. See docs/ADR-BILL-001-subscription-ownership-strategy.md.
  @Prop({ type: String, enum: BillingCycle, default: BillingCycle.MONTHLY })
  billingCycle!: BillingCycle;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
