/** FRD-001 Volume-4 — mirrors `apps/api`'s real local `TemplateStatus` enum (`template.schema.ts`), NOT `@wapp/shared-types` (whose `TemplateStatus` has drifted — it has `SUBMITTED`, the real backend has `PAUSED` instead; see `types/conversation.ts`'s top comment for the full finding). `DRAFT` is local-only (never submitted); `PENDING`/`APPROVED`/`REJECTED`/`PAUSED`/`DISABLED` mirror Meta's own review states. */
export type TemplateStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED";

/** Matches `@wapp/shared-types`'s `TemplateCategory` exactly — safe to treat as stable, unlike `TemplateStatus`. Kept local anyway for consistency with the rest of this module's types. */
export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

/** Mirrors `TemplateComponent` — deliberately loose (`buttons` untyped) since Meta's own template review is the real validator, not this frontend. */
export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  text?: string;
  buttons?: Array<Record<string, unknown>>;
}

/** Mirrors `TemplateSummary`. Submitted templates (`status !== "DRAFT"`) are immutable — "Edit" in the UI means creating a brand-new Template document (ADR-COMM-005), never a PATCH; no such route exists. */
export interface TemplateSummary {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  components: TemplateComponent[];
  status: TemplateStatus;
  metaTemplateId: string | null;
  rejectionReason: string | null;
  createdAt: string;
}
