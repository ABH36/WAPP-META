import { apiGet } from "../lib/api";
import type { PlatformAnalyticsSnapshot, PlatformKpiSnapshot } from "../types/platform";

/**
 * FRD-001 Volume-8 §4.9 — Analytics. `VIEW_PLATFORM_ANALYTICS`. Covers
 * only Platform KPIs / Revenue / Workspace Growth — "User Growth,"
 * "Subscription Trends," and "Activity Trends" have no backend endpoint
 * anywhere and are not represented here (Architecture Review, 2026-08-12).
 */
export const analyticsService = {
  snapshot(): Promise<PlatformAnalyticsSnapshot> {
    return apiGet("/platform/analytics");
  },

  kpis(): Promise<PlatformKpiSnapshot> {
    return apiGet("/platform/kpis");
  },
};
