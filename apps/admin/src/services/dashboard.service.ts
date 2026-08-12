import { apiGet } from "../lib/api";
import type {
  PlatformBillingDashboardSnapshot,
  PlatformDashboardSnapshot,
} from "../types/platform";

/**
 * FRD-001 Volume-8 §4.1 — `VIEW_PLATFORM_DASHBOARD`/`VIEW_PLATFORM_BILLING`.
 * No single all-in-one dashboard endpoint exists — the Platform Dashboard
 * screen composes both of these calls (Architecture Review, 2026-08-12).
 * No platform-wide "recent activity" endpoint exists at all.
 */
export const dashboardService = {
  snapshot(): Promise<PlatformDashboardSnapshot> {
    return apiGet("/platform/dashboard");
  },

  billingSnapshot(): Promise<PlatformBillingDashboardSnapshot> {
    return apiGet("/platform/billing/dashboard");
  },
};
