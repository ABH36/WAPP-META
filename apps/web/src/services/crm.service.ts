import { apiClient, apiGet } from "../lib/api";
import type {
  ActivityReport,
  DashboardSummary,
  DealReport,
  ExportFormat,
  ExportReportType,
  ForecastReport,
  LeadReport,
  ReportsQueryOptions,
} from "../types/crm";

/**
 * FRD-001 Volume-3 §4.8 / FRD-001 Volume-5 §4.10/§4.11 — every route here
 * requires `VIEW_REPORTS` (Owner/Administrator=FULL, other roles use the
 * pre-scaffolded `TEAM_SCOPED`/`OWN_SCOPED`/`CAMPAIGN_SCOPED` levels —
 * never `NONE`, so no permission gate is needed before calling any of
 * these). Those scoped levels are NOT actually enforced server-side
 * (ADR-CRM-020, confirmed by an existing backend e2e test) — every role
 * with any `VIEW_REPORTS` grant sees identical, full workspace-wide data.
 * The frontend must not imply narrower per-role scoping in its copy/UI
 * that the backend doesn't actually provide. Only Lead/Deal/Activity
 * Report are exposed this volume — "Sales Report"/"Customer Report" have
 * no dedicated backend routes (see docs/TECH-DEBT.md).
 */
export const crmService = {
  dashboardSummary(query?: ReportsQueryOptions): Promise<DashboardSummary> {
    return apiGet("/crm/reports/dashboard", query as Record<string, unknown> | undefined);
  },

  leadReport(query?: ReportsQueryOptions): Promise<LeadReport> {
    return apiGet("/crm/reports/leads", query as Record<string, unknown> | undefined);
  },

  dealReport(query?: ReportsQueryOptions): Promise<DealReport> {
    return apiGet("/crm/reports/deals", query as Record<string, unknown> | undefined);
  },

  activityReport(query?: ReportsQueryOptions): Promise<ActivityReport> {
    return apiGet("/crm/reports/activities", query as Record<string, unknown> | undefined);
  },

  forecast(query?: ReportsQueryOptions): Promise<ForecastReport> {
    return apiGet("/crm/reports/forecast", query as Record<string, unknown> | undefined);
  },

  /**
   * `GET /crm/reports/export` returns a binary file (CSV/Excel), not a
   * JSON envelope, and requires the same Bearer token every other CRM
   * call does — a plain `<a href>` can't carry that (the access token
   * lives in memory only, never a cookie, per ADR-FE-001). This fetches
   * through the same authenticated `apiClient` instance with
   * `responseType: "blob"` instead; the caller is responsible for
   * triggering the actual browser download (see `lib/download-blob.ts`).
   */
  async exportReport(
    type: ExportReportType,
    format: ExportFormat,
    query?: ReportsQueryOptions,
  ): Promise<Blob> {
    const response = await apiClient.get<Blob>("/crm/reports/export", {
      params: { type, format, ...query },
      responseType: "blob",
    });
    return response.data;
  },
};
