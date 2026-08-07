import { DealStage, LeadStatus, TenantRole } from "@wapp/shared-types";

/**
 * PRD-004 Volume-2 §11/BR-005 — "active" for duplicate-prevention purposes.
 * The complement of TERMINAL_LEAD_STATUSES (WON/LOST/UNQUALIFIED), listed
 * explicitly here because Mongo's partialFilterExpression needs a concrete
 * $in list, not a derived negation.
 */
export const LEAD_ACTIVE_STATUSES: readonly LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.PROPOSAL_SENT,
  LeadStatus.NEGOTIATION,
];

/**
 * PRD-004 Volume-2 §7/§8 — the full legal transition set (resolved
 * 2026-08-06, Architecture Review): a linear forward pipeline with no
 * skipping/backward moves, but LOST and UNQUALIFIED are each reachable from
 * any non-terminal stage (a lead can die, or turn out to never have
 * qualified, at any point) — see docs/ADR-CRM-005-lead-qualification-strategy.md.
 */
export const LEAD_STATUS_TRANSITIONS: Readonly<Record<LeadStatus, readonly LeadStatus[]>> = {
  [LeadStatus.NEW]: [LeadStatus.CONTACTED, LeadStatus.LOST, LeadStatus.UNQUALIFIED],
  [LeadStatus.CONTACTED]: [LeadStatus.QUALIFIED, LeadStatus.LOST, LeadStatus.UNQUALIFIED],
  [LeadStatus.QUALIFIED]: [LeadStatus.PROPOSAL_SENT, LeadStatus.LOST, LeadStatus.UNQUALIFIED],
  [LeadStatus.PROPOSAL_SENT]: [LeadStatus.NEGOTIATION, LeadStatus.LOST, LeadStatus.UNQUALIFIED],
  [LeadStatus.NEGOTIATION]: [LeadStatus.WON, LeadStatus.LOST, LeadStatus.UNQUALIFIED],
  [LeadStatus.WON]: [],
  [LeadStatus.LOST]: [],
  [LeadStatus.UNQUALIFIED]: [],
};

/** PRD-004 Volume-2 §10 — "assigned to one Sales Executive" specifically, not the broader set of roles with Lead access. */
export const LEAD_ELIGIBLE_ASSIGNEE_ROLES = [TenantRole.SALES_EXECUTIVE] as const;

/**
 * PRD-004 Volume-4 §4/§7 — a linear forward pipeline with no skipping/
 * backward moves, but LOST is reachable from any non-terminal stage
 * (resolved 2026-08-06, Architecture Review) — same reasoning as
 * LEAD_STATUS_TRANSITIONS's own LOST/UNQUALIFIED reachability, not the
 * PRD's literal "OPEN → LOST" diagram. WON is reachable only from
 * NEGOTIATION ("no skipping directly from OPEN → WON", §7). Neither
 * terminal stage has an outbound entry here — LOST's only way out is the
 * dedicated reopen endpoint (DealService.reopen), which resets to OPEN
 * directly rather than going through this matrix; WON has no way out at
 * all. See docs/ADR-CRM-012-deal-lifecycle-strategy.md.
 */
export const DEAL_STAGE_TRANSITIONS: Readonly<Record<DealStage, readonly DealStage[]>> = {
  [DealStage.OPEN]: [DealStage.QUALIFICATION, DealStage.LOST],
  [DealStage.QUALIFICATION]: [DealStage.PROPOSAL, DealStage.LOST],
  [DealStage.PROPOSAL]: [DealStage.NEGOTIATION, DealStage.LOST],
  [DealStage.NEGOTIATION]: [DealStage.WON, DealStage.LOST],
  [DealStage.WON]: [],
  [DealStage.LOST]: [],
};

/** PRD-004 Volume-4 §8 — "Sales Executive may own Deals," mirrors LEAD_ELIGIBLE_ASSIGNEE_ROLES exactly (resolved 2026-08-06). */
export const DEAL_ELIGIBLE_ASSIGNEE_ROLES = [TenantRole.SALES_EXECUTIVE] as const;
