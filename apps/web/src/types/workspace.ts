import type { WorkspaceStatus } from "@wapp/shared-types";

/** FRD-001 Volume-3 §4.2 — mirrors `apps/api`'s `BusinessProfile` exactly. No `website`/`address` fields exist on the backend schema — deliberately not invented here (Architecture Review, 2026-08-10). */
export interface BusinessProfile {
  category: string | null;
  description: string | null;
  gstin: string | null;
}

/** FRD-001 Volume-3 §4.3 — mirrors `apps/api`'s `BusinessHoursDay` (`workspace.schema.ts`). `dayOfWeek` is 0 (Sunday) through 6 (Saturday). */
export interface BusinessHoursDay {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

/** FRD-001 Volume-3 §4.3 — mirrors `apps/api`'s `PublicHoliday`. Manual entry only, no calendar sync. */
export interface PublicHoliday {
  date: string;
  name: string;
}

/** FRD-001 Volume-3 §4.3 — mirrors `apps/api`'s `BusinessHours`. */
export interface BusinessHours {
  timezone: string;
  schedule: BusinessHoursDay[];
  publicHolidays: PublicHoliday[];
}

/** FRD-001 Volume-3 §4.6 — mirrors `apps/api`'s `Workspace.notificationSettings` (workspace module, not settings module). The distinct per-user notification matrix (`Settings` module) is out of scope for this volume. */
export interface WorkspaceNotificationSettings {
  taskFollowUpReminder: boolean;
  conversationLeadAssignment: boolean;
  broadcastCompleted: boolean;
  subscriptionReminder: boolean;
}

/**
 * FRD-001 Volume-3 §4.1/§4.2/§4.3/§4.6/§4.7 — mirrors `apps/api`'s
 * `WorkspaceProfile` (`workspace.mapper.ts`) field-for-field. Deliberately
 * has no `updatedAt`/`statusReason`/plan fields — the mapper omits the
 * first two, and "Current Plan" is sourced from Billing, never Workspace
 * (Architecture Review, 2026-08-10).
 */
export interface WorkspaceProfile {
  id: string;
  name: string;
  ownerId: string;
  businessProfile: BusinessProfile;
  businessHours: BusinessHours;
  notificationSettings: WorkspaceNotificationSettings;
  language: string;
  status: WorkspaceStatus;
  createdAt: string;
}
