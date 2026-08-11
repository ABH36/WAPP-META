import { apiGet, apiPatch } from "../lib/api";
import type {
  BusinessHours,
  BusinessProfile,
  WorkspaceNotificationSettings,
  WorkspaceProfile,
} from "../types/workspace";

type UpdateBusinessProfilePayload = Partial<
  Pick<BusinessProfile, "category" | "description" | "gstin">
>;
type UpdateBusinessHoursPayload = Pick<BusinessHours, "timezone" | "schedule" | "publicHolidays">;
type UpdateNotificationSettingsPayload = Partial<WorkspaceNotificationSettings>;

/**
 * FRD-001 Volume-2 §4.4 / FRD-001 Volume-3 §4.1-§4.3/§4.6 — `GET /workspaces/me`
 * (not `/workspaces/:id` — that route doesn't exist; the backend resolves
 * "current workspace" from the authenticated user's own `workspaceId`,
 * mirroring `/auth/me`'s shape). Business Profile / Business Hours /
 * Notification Settings writes stay on this service (the workspace
 * module's own routes), never moved into `settings.service.ts` — mirrors
 * the backend's own Identity/Settings-style orchestration split
 * (ADR-SET-001): Settings only reads these fields through `GET /settings`,
 * it never owns writing them.
 */
export const workspaceService = {
  current(): Promise<WorkspaceProfile> {
    return apiGet("/workspaces/me");
  },

  updateBusinessProfile(payload: UpdateBusinessProfilePayload): Promise<WorkspaceProfile> {
    return apiPatch("/workspaces/me/business-profile", payload);
  },

  updateBusinessHours(payload: UpdateBusinessHoursPayload): Promise<WorkspaceProfile> {
    return apiPatch("/workspaces/me/business-hours", payload);
  },

  updateNotificationSettings(
    payload: UpdateNotificationSettingsPayload,
  ): Promise<WorkspaceProfile> {
    return apiPatch("/workspaces/me/notification-settings", payload);
  },
};
