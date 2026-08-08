/** Traces to: PRD-006 Volume-2 §4.1 (Appearance) / §9 (Validation). */
export enum Theme {
  LIGHT = "LIGHT",
  DARK = "DARK",
  SYSTEM = "SYSTEM",
}

export enum SidebarState {
  EXPANDED = "EXPANDED",
  COLLAPSED = "COLLAPSED",
}

export enum UiDensity {
  COMFORTABLE = "COMFORTABLE",
  COMPACT = "COMPACT",
}

/**
 * §4.4 — personal, per-user notification preferences. Deliberately separate
 * from Workspace's own workspace-wide `notificationSettings` (Volume-1) —
 * different concept, different owner, different scope (BR-005).
 */
export enum NotificationEventType {
  NEW_ASSIGNMENT = "NEW_ASSIGNMENT",
  NEW_LEAD = "NEW_LEAD",
  DEAL_WON = "DEAL_WON",
  MENTION = "MENTION",
  TASK_REMINDER = "TASK_REMINDER",
  FOLLOW_UP_REMINDER = "FOLLOW_UP_REMINDER",
  BILLING_REMINDER = "BILLING_REMINDER",
}

/** §9 — the only two channels implemented in Volume-2; Browser Push/Mobile Push are explicitly "Future" per §4.4. */
export enum NotificationChannel {
  IN_APP = "IN_APP",
  EMAIL = "EMAIL",
}
