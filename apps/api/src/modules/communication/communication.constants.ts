import { TenantRole } from "@wapp/shared-types";

/**
 * Auto-close threshold for RESOLVED conversations (BDC-012 — "Resolved ->
 * Closed via Auto-Close after configured inactivity"). Fixed platform-wide
 * for Part-2, not yet per-workspace configurable — see TD-003 in
 * docs/TECH-DEBT.md. Original module scope said "configurable duration";
 * this is a known, deliberate simplification, not an oversight.
 */
export const CONVERSATION_AUTO_CLOSE_HOURS = 24;

/** How often the auto-close sweep runs. */
export const CONVERSATION_AUTO_CLOSE_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export const CONVERSATION_AUTO_CLOSE_QUEUE = "conversation-auto-close";

/**
 * Part 4a (Automation Engine) — minimum gap between two auto-replies of the
 * *same* type (Welcome or Away, tracked independently — see
 * docs/COMM-AUTOMATION-BUSINESS-HOURS.md) on the same Conversation. Fixed
 * platform-wide, not yet per-workspace configurable — same known
 * simplification pattern as CONVERSATION_AUTO_CLOSE_HOURS above (see
 * docs/TECH-DEBT.md).
 */
export const AUTO_REPLY_COOLDOWN_HOURS = 12;

/**
 * Part 4b (Auto Assignment) — the front-line, conversation-handling roles
 * eligible to receive an automatic assignment. Deliberately excludes
 * Managers/Owner/Administrator (who also hold REPLY_CONVERSATIONS, but are
 * not the intended auto-assignment pool) and Marketing Executive (no
 * REPLY_CONVERSATIONS access at all) — see docs/COMM-AUTO-ASSIGNMENT.md.
 */
export const AUTO_ASSIGNMENT_ELIGIBLE_ROLES = [
  TenantRole.SALES_EXECUTIVE,
  TenantRole.SUPPORT_EXECUTIVE,
] as const;

/**
 * Part 4c (SLA Monitoring + Escalation Rules) — how long a Conversation may
 * go with the customer's last message still unanswered before it's an SLA
 * breach (see docs/COMM-SLA-ESCALATION.md — response-time SLA, not
 * resolution-time). Fixed platform-wide, not yet per-workspace configurable
 * or business-hours-aware — same known simplification pattern as
 * CONVERSATION_AUTO_CLOSE_HOURS above (see TD-005, docs/TECH-DEBT.md). Also
 * doubles as the re-escalation cooldown — a Conversation already escalated
 * isn't escalated again until another full window has passed with still no
 * reply.
 */
export const SLA_RESPONSE_HOURS = 4;

/** How often the SLA escalation sweep runs. */
export const SLA_ESCALATION_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export const SLA_ESCALATION_QUEUE = "sla-escalation";

/** Part 4c — the roles an SLA-breached Conversation may be escalated to. */
export const SLA_ESCALATION_MANAGER_ROLES = [
  TenantRole.SALES_MANAGER,
  TenantRole.SUPPORT_MANAGER,
] as const;
