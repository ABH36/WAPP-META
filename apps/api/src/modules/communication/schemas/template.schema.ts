import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type TemplateDocument = HydratedDocument<Template>;

/** Meta's own top-level template categories (WhatsApp Business Management API). */
export enum TemplateCategory {
  MARKETING = "MARKETING",
  UTILITY = "UTILITY",
  AUTHENTICATION = "AUTHENTICATION",
}

/**
 * DRAFT is local-only (never submitted). PENDING/APPROVED/REJECTED/PAUSED/
 * DISABLED mirror Meta's own template review states — PAUSED/DISABLED are
 * Meta-side outcomes for a previously-approved template that's since been
 * flagged for quality/policy reasons, tracked here so the Compliance Engine
 * (docs/COMM-COMPLIANCE-ENGINE.md) can tell "approved" from "still usable."
 */
export enum TemplateStatus {
  DRAFT = "DRAFT",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  PAUSED = "PAUSED",
  DISABLED = "DISABLED",
}

/**
 * One message template component, matching Meta's own component shape
 * (WhatsApp Business Management API) closely enough to round-trip without
 * lossy re-modeling — deliberately not a fully-typed union of every header
 * format / button type Meta supports, since this slice only needs to store
 * and display them, not validate every variant server-side (Meta's own
 * template review is the actual source of truth for validity).
 */
export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  text?: string;
  buttons?: Array<Record<string, unknown>>;
}

/**
 * Traces to: PRD-003 Part 3 (Templates), BDC-010 (in-platform creation +
 * submission is Phase-1 scope, not just Meta-sync). One Template per
 * (workspaceId, name, language) — Meta's own uniqueness rule for a WABA.
 */
@Schema({ timestamps: true, collection: "templates" })
export class Template {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  // Meta's template name — lowercase_snake_case by Meta's own convention,
  // not enforced here (Meta's submission call rejects an invalid name).
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, enum: TemplateCategory, required: true })
  category!: TemplateCategory;

  // BCP-47 / Meta's language code format, e.g. "en_US".
  @Prop({ type: String, required: true })
  language!: string;

  @Prop({ type: [Object], required: true })
  components!: TemplateComponent[];

  @Prop({ type: String, enum: TemplateStatus, required: true, default: TemplateStatus.DRAFT })
  status!: TemplateStatus;

  // Set once submitted to Meta; null for a still-local DRAFT.
  @Prop({ type: String, default: null, index: true })
  metaTemplateId!: string | null;

  @Prop({ type: String, default: null })
  rejectionReason!: string | null;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ default: false })
  isDeleted!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const TemplateSchema = SchemaFactory.createForClass(Template);

TemplateSchema.index({ workspaceId: 1, name: 1, language: 1 }, { unique: true });
