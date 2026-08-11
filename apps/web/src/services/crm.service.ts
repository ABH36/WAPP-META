import { apiGet } from "../lib/api";
import type { DashboardSummary } from "../types/crm";

/** FRD-001 Volume-3 §4.8 — the CRM Summary Card's data source. Requires `VIEW_REPORTS` (Owner/Administrator=FULL, other roles scoped — never NONE, so no permission gate is needed before calling this, unlike Billing). No query filters are passed — the card shows the unfiltered, all-time dashboard total. */
export const crmService = {
  dashboardSummary(): Promise<DashboardSummary> {
    return apiGet("/crm/reports/dashboard");
  },
};
