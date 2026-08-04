/**
 * Traces to: PRD-002 Part 3A (Team Invitation Module).
 *
 * PENDING/ACCEPTED/REVOKED are the only values ever persisted
 * (`WorkspaceInvitation.status` in apps/api) — EXPIRED is a derived,
 * read-time-only value (a still-PENDING invitation whose `expiresAt` has
 * passed), never written to the database. This mirrors how
 * `WorkspaceStatus`'s access implications are derived rather than
 * duplicated — do not add an "expire" write path/cron job for this.
 */
export enum InvitationStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  EXPIRED = "EXPIRED",
  REVOKED = "REVOKED",
}
