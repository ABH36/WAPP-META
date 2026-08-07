/**
 * Traces to: PRD-004 Volume-5 (Activities, Tasks, Follow-ups & Notes),
 * SAD-001 Volume-1 ARCH-003, SAD-002 PATCH-003. Phase-1 uses a SINGLE
 * `activities` collection with this discriminator field — do not create
 * separate collections/tables per type without a new ADR. REMINDER kept as
 * its own type (resolved 2026-08-07, Architecture Review) even though
 * Volume-5 §4's own list omits it — see
 * docs/ADR-CRM-015-activity-timeline-strategy.md.
 */
export enum ActivityType {
  NOTE = "NOTE",
  TASK = "TASK",
  FOLLOW_UP = "FOLLOW_UP",
  REMINDER = "REMINDER",
  CALL = "CALL",
  MEETING = "MEETING",
  EMAIL = "EMAIL",
}

/** Only applicable when ActivityType = TASK. PRD-004 Volume-5 §6. */
export enum TaskStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

/** Only applicable when ActivityType = TASK. PRD-004 Volume-5 §6. */
export enum TaskPriority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

/** Only applicable when ActivityType = FOLLOW_UP. PRD-004 Volume-5 §7. */
export enum FollowUpType {
  CALL = "CALL",
  WHATSAPP = "WHATSAPP",
  MEETING = "MEETING",
  EMAIL = "EMAIL",
}

/**
 * Only applicable when ActivityType = REMINDER. PRD-004 Volume-5 §9 — data
 * shape only; actual delivery is Notification-module scope, not built here
 * (BR-007, docs/ADR-CRM-015-activity-timeline-strategy.md).
 */
export enum ReminderType {
  NOTIFICATION = "NOTIFICATION",
  EMAIL = "EMAIL",
}
