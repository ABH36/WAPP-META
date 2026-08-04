/**
 * Traces to: PRD-004 Volume 3, SAD-001 Volume-1 ARCH-003, SAD-002 PATCH-003.
 * Phase-1 uses a SINGLE `activities` collection with this discriminator field —
 * do not create separate collections/tables per type without a new ADR.
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

/** Only applicable when ActivityType = TASK. PRD-004 Volume 3 §C. */
export enum TaskStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

/** Only applicable when ActivityType = TASK. PRD-004 Volume 3 §C. */
export enum TaskPriority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT",
}
