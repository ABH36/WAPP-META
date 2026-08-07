/**
 * Traces to: PRD-005 Volume-3 §5/§6. §5's named capabilities (feature
 * entitlements — binary on/off per Plan) and §6's named resource counters
 * (numeric ceilings per Plan) are deliberately separate enums even though
 * both are configured per-Plan and read together — they answer different
 * questions ("can this Workspace use X at all" vs "how many of Y may this
 * Workspace have"). See docs/ADR-BILL-007-usage-counter-strategy.md.
 */
export enum UsageFeature {
  CRM = "CRM",
  BROADCAST = "BROADCAST",
  CAMPAIGNS = "CAMPAIGNS",
  AUTOMATION = "AUTOMATION",
  TEAM_MEMBERS = "TEAM_MEMBERS",
  REPORTS = "REPORTS",
  API_ACCESS = "API_ACCESS",
  WEBHOOKS = "WEBHOOKS",
  INTEGRATIONS = "INTEGRATIONS",
}

/**
 * §6 lists 9 counters; only 6 have a real creation-time domain event to
 * hook into today (resolved during implementation, 2026-08-07): Storage
 * (uploads bypass the API — SEC-016), API Requests (no commercial,
 * per-workspace request counter exists, only the technical ThrottlerModule
 * rate limiter), and Campaigns (no CAMPAIGN_CREATED/STARTED event exists in
 * Communication's catalog, only completion-time events) are all deferred —
 * see TD-013, docs/TECH-DEBT.md. This enum still declares all 9 for
 * forward-compatibility (matching how Plan.monthlyPrice stayed a real field
 * while null pending approval, TD-009) — the 3 deferred values simply have
 * no listener incrementing them yet.
 */
export enum UsageCounterType {
  TEAM_MEMBERS = "TEAM_MEMBERS",
  CUSTOMERS = "CUSTOMERS",
  LEADS = "LEADS",
  DEALS = "DEALS",
  BROADCASTS = "BROADCASTS",
  CAMPAIGNS = "CAMPAIGNS",
  MESSAGES = "MESSAGES",
  STORAGE = "STORAGE",
  API_REQUESTS = "API_REQUESTS",
}

export const DEFERRED_USAGE_COUNTERS: readonly UsageCounterType[] = [
  UsageCounterType.CAMPAIGNS,
  UsageCounterType.STORAGE,
  UsageCounterType.API_REQUESTS,
];

/** Resolved 2026-08-07, Architecture Review — §8. 100% is a warning, not yet a rejection; rejection happens only once usage would exceed the limit. */
export const USAGE_WARNING_THRESHOLDS: readonly number[] = [80, 90, 100];
