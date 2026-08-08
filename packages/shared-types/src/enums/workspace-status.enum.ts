/**
 * Traces to: PRD-005 v1.2 §D (Workspace Status Definitions), ADR-017.
 * ARCHIVED added in PRD-007 Volume-1 §4.1/ADR-PLAT-001 — resolved
 * 2026-08-08, Architecture Review: a new, terminal, platform-admin-only
 * status, independent of the CANCELLED -> 90-day-retention lifecycle
 * (ADR-020) — never auto-derived from it.
 *
 * Access implications (do not re-derive elsewhere — this is the canonical mapping):
 * - TRIAL / ACTIVE: full access.
 * - EXPIRED: read-only. Login allowed. CRM editing, messaging, broadcast, and
 *   settings modification are blocked. Invoice download and renewal remain available.
 * - SUSPENDED: platform login itself is blocked (harder than EXPIRED — reserved
 *   for fraud/policy-violation/chargeback/abuse, set exclusively by Platform
 *   Administration — PRD-007 Volume-1).
 * - CANCELLED: active until the current billing period ends, then transitions
 *   into the 90-day read-only retention window (ADR-020) under this same status.
 * - ARCHIVED: platform login blocked, same as SUSPENDED — a platform-admin-only
 *   action to remove a workspace (test/spam/abandoned) from the active registry,
 *   set directly by Platform Administration, never a lifecycle-sweep outcome.
 */
export enum WorkspaceStatus {
  TRIAL = "TRIAL",
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  SUSPENDED = "SUSPENDED",
  CANCELLED = "CANCELLED",
  ARCHIVED = "ARCHIVED",
}

/** Statuses under which platform login itself is blocked. */
export const LOGIN_BLOCKED_WORKSPACE_STATUSES: readonly WorkspaceStatus[] = [
  WorkspaceStatus.SUSPENDED,
  WorkspaceStatus.ARCHIVED,
];

/** Statuses under which the workspace is read-only (login allowed, mutation blocked). */
export const READ_ONLY_WORKSPACE_STATUSES: readonly WorkspaceStatus[] = [WorkspaceStatus.EXPIRED];
