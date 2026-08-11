import type {
  ActivityType,
  FollowUpType,
  ReminderType,
  TaskPriority,
  TaskStatus,
} from "@wapp/shared-types";

/**
 * FRD-001 Volume-5 §4.6/§4.7/§4.8 — mirrors `apps/api`'s `ActivitySummary`.
 * One flat shape for all 7 `ActivityType` values (`NOTE`, `TASK`,
 * `FOLLOW_UP`, `REMINDER`, `CALL`, `MEETING`, `EMAIL`) — Tasks and Notes
 * are NOT separate resources, they're `type`-discriminated Activities
 * (Architecture Review, 2026-08-11). Type-specific fields
 * (`dueDate`/`priority`/`status` for Task, `text`/`mentions` for Note,
 * etc.) are simply `null` for activities of a different type.
 */
export interface ActivitySummary {
  id: string;
  workspaceId: string;
  type: ActivityType;
  customerId: string | null;
  dealId: string | null;
  title: string | null;
  description: string | null;
  text: string | null;
  mentions: string[];
  dueDate: string | null;
  priority: TaskPriority | null;
  status: TaskStatus | null;
  assignedUserId: string | null;
  followUpDate: string | null;
  followUpType: FollowUpType | null;
  followUpCompletedAt: string | null;
  reminderDate: string | null;
  reminderType: ReminderType | null;
  archivedAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
