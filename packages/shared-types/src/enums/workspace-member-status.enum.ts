/**
 * Traces to: PRD-002 Part 3A/3B (Workspace Member States), resolved 2026-08-04
 * during Phase-3 (Workspace & Tenant Management) after being flagged as an
 * open contradiction across three documents (Part 3A, Part 3B, BRD-001) —
 * some listed a 5th "Inactive" state with no defined trigger. Resolved by
 * Product Owner decision: 4 states only, no Inactive.
 *
 * Access implications (canonical — do not re-derive elsewhere):
 * - PENDING: invitation sent, not yet accepted. No platform access.
 * - ACTIVE: full access per their TenantRole.
 * - SUSPENDED: platform access blocked (PRD-002 Part 3B). Continues to
 *   consume a seat — only Removal releases it.
 * - REMOVED: platform access revoked, seat released. Terminal state.
 */
export enum WorkspaceMemberStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  REMOVED = "REMOVED",
}

/** Statuses under which platform login/access is blocked for this workspace membership. */
export const BLOCKED_MEMBER_STATUSES: readonly WorkspaceMemberStatus[] = [
  WorkspaceMemberStatus.PENDING,
  WorkspaceMemberStatus.SUSPENDED,
  WorkspaceMemberStatus.REMOVED,
];
