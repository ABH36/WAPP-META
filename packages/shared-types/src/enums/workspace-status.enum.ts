/**
 * Traces to: PRD-005 v1.2 §D (Workspace Status Definitions), ADR-017.
 *
 * Access implications (do not re-derive elsewhere — this is the canonical mapping):
 * - TRIAL / ACTIVE: full access.
 * - EXPIRED: read-only. Login allowed. CRM editing, messaging, broadcast, and
 *   settings modification are blocked. Invoice download and renewal remain available.
 * - SUSPENDED: platform login itself is blocked (harder than EXPIRED — reserved
 *   for fraud/policy-violation/chargeback/abuse per PRD-007 Vol 3 §D).
 * - CANCELLED: active until the current billing period ends, then transitions
 *   into the 90-day read-only retention window (ADR-020) under this same status.
 */
export enum WorkspaceStatus {
  TRIAL = "TRIAL",
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  SUSPENDED = "SUSPENDED",
  CANCELLED = "CANCELLED",
}

/** Statuses under which platform login itself is blocked. */
export const LOGIN_BLOCKED_WORKSPACE_STATUSES: readonly WorkspaceStatus[] = [
  WorkspaceStatus.SUSPENDED,
];

/** Statuses under which the workspace is read-only (login allowed, mutation blocked). */
export const READ_ONLY_WORKSPACE_STATUSES: readonly WorkspaceStatus[] = [WorkspaceStatus.EXPIRED];
