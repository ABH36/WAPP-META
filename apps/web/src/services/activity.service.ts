import type {
  ActivityType,
  FollowUpType,
  ReminderType,
  TaskPriority,
  TaskStatus,
} from "@wapp/shared-types";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { Paginated } from "../types/pagination";
import type { ActivitySummary } from "../types/activity";

export interface CreateActivityPayload {
  type: ActivityType;
  customerId?: string;
  dealId?: string;
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: TaskPriority;
  assignedUserId?: string;
  followUpDate?: string;
  followUpType?: FollowUpType;
  reminderDate?: string;
  reminderType?: ReminderType;
}

export interface UpdateActivityPayload {
  title?: string;
  description?: string;
  text?: string;
  mentions?: string[];
  dueDate?: string;
  priority?: TaskPriority;
  followUpDate?: string;
  followUpType?: FollowUpType;
  reminderDate?: string;
  reminderType?: ReminderType;
}

export interface CreateNotePayload {
  customerId?: string;
  dealId?: string;
  text: string;
  mentions?: string[];
}

interface ListActivitiesParams {
  type?: ActivityType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedUserId?: string;
  customerId?: string;
  dealId?: string;
  dueFrom?: string;
  dueTo?: string;
  sortBy?: "createdAt" | "updatedAt" | "dueDate" | "priority";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * FRD-001 Volume-5 §4.6/§4.7/§4.8 — Tasks and Notes are NOT independent
 * resources; both are `ActivityType`-discriminated Activities sharing
 * this one service (Architecture Review, 2026-08-11). No
 * `@RequirePermission` gates this controller at all — access is derived
 * per-instance from whichever `VIEW_CUSTOMERS`/`EDIT_CUSTOMER`/
 * `VIEW_DEALS`/`CREATE_DEALS` the Activity's `customerId`/`dealId`
 * references, both required (AND) if both are set (`lib/permissions.ts`'s
 * `useActivityPermission`). `dueFrom`/`dueTo` only filter Task's
 * `dueDate` server-side — Follow-up's `followUpDate` has no server-side
 * date-range filter. Completion differs by subtype: Task uses
 * `updateTaskStatus`, Follow-up uses `completeFollowUp` — there is no
 * generic "complete" action.
 */
export const activityService = {
  create(payload: CreateActivityPayload): Promise<ActivitySummary> {
    return apiPost("/crm/activities", payload);
  },

  list(params: ListActivitiesParams): Promise<Paginated<ActivitySummary>> {
    return apiGet("/crm/activities", params as Record<string, unknown>);
  },

  search(q: string, page?: number, limit?: number): Promise<Paginated<ActivitySummary>> {
    return apiGet("/crm/activities/search", { q, page, limit });
  },

  getById(id: string): Promise<ActivitySummary> {
    return apiGet(`/crm/activities/${id}`);
  },

  update(id: string, payload: UpdateActivityPayload): Promise<ActivitySummary> {
    return apiPatch(`/crm/activities/${id}`, payload);
  },

  archive(id: string): Promise<ActivitySummary> {
    return apiPatch(`/crm/activities/${id}/archive`);
  },

  assignTask(id: string, assignedUserId: string | null): Promise<ActivitySummary> {
    return apiPatch(`/crm/tasks/${id}/assign`, { assignedUserId });
  },

  updateTaskStatus(id: string, status: TaskStatus): Promise<ActivitySummary> {
    return apiPatch(`/crm/tasks/${id}/status`, { status });
  },

  assignFollowUp(id: string, assignedUserId: string | null): Promise<ActivitySummary> {
    return apiPatch(`/crm/follow-ups/${id}/assign`, { assignedUserId });
  },

  completeFollowUp(id: string): Promise<ActivitySummary> {
    return apiPatch(`/crm/follow-ups/${id}/complete`);
  },

  createNote(payload: CreateNotePayload): Promise<ActivitySummary> {
    return apiPost("/crm/notes", payload);
  },
};
