import { apiGet, apiPost } from "../lib/api";
import type { AnnouncementTargetType, PlatformAnnouncementSummary } from "../types/platform";

export interface CreateAnnouncementPayload {
  title: string;
  message: string;
  targetType: AnnouncementTargetType;
  targetPlanIds?: string[];
  targetWorkspaceIds?: string[];
}

/**
 * FRD-001 Volume-8 §4.10 — Global Announcements. `MANAGE_ANNOUNCEMENTS`
 * (FULL for Super-Admin/Support-Manager, VIEW_ONLY for Support-Executive —
 * read-only for that role). Create + List only — no status field, no
 * scheduling, no Publish/Archive routes exist anywhere, and the domain
 * event this fires has zero consumers (nothing is ever delivered to a
 * tenant). Architecture Review, 2026-08-12: minimal Create + List only,
 * no fabricated Active/Scheduled/Expired states.
 */
export const announcementsService = {
  list(): Promise<PlatformAnnouncementSummary[]> {
    return apiGet("/platform/announcements");
  },

  create(payload: CreateAnnouncementPayload): Promise<PlatformAnnouncementSummary> {
    return apiPost("/platform/announcements", payload);
  },
};
