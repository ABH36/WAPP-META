/** Traces to: PRD-003 Part 3 §B (Broadcast Status). */
export enum BroadcastStatus {
  DRAFT = "DRAFT",
  SCHEDULED = "SCHEDULED",
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  FAILED = "FAILED",
}

/** Traces to: PRD-003 Part 3 §A (Template Status). */
export enum TemplateStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  DISABLED = "DISABLED",
}

/** Traces to: PRD-003 Part 3 §A — Meta's official template categories. */
export enum TemplateCategory {
  MARKETING = "MARKETING",
  UTILITY = "UTILITY",
  AUTHENTICATION = "AUTHENTICATION",
}

/** Traces to: PRD-003 Part 1 §C (Phone Status). */
export enum PhoneNumberStatus {
  CONNECTED = "CONNECTED",
  DISCONNECTED = "DISCONNECTED",
  PENDING = "PENDING",
  VERIFICATION_REQUIRED = "VERIFICATION_REQUIRED",
  RESTRICTED = "RESTRICTED",
  DISABLED = "DISABLED",
}

/**
 * Traces to: PRD-003 Part 3 Global Business Rules / BDC-008 (Meta Compliance Scope).
 * The Meta Compliance Engine applies to ALL outgoing WhatsApp messages — 1:1 agent
 * replies, Broadcasts, Campaigns, and Template messages alike. This 24-hour window
 * determines whether a free-form reply is permitted or a Template is required.
 */
export const WHATSAPP_SESSION_WINDOW_HOURS = 24;
