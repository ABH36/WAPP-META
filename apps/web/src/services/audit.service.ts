import { apiGet } from "../lib/api";
import type { AuditCategory, AuditLogPage } from "../types/settings";

export interface AuditLogQueryParams {
  category?: AuditCategory;
  page?: number;
  limit?: number;
}

/**
 * FRD-001 Volume-7 §4.10 — `EDIT_WORKSPACE` (tightened from the FRD's
 * originally-implied `VIEW_REPORTS`, per the backend's own doc-comment:
 * "the broader VIEW_REPORTS proposed in §7 was rejected given the
 * security-sensitive actor/IP/device data"). Query supports category
 * filter + pagination only — no free-text search param exists
 * (`AuditLogQueryDto`), so no search box is built against it.
 */
export const auditService = {
  list(params: AuditLogQueryParams): Promise<AuditLogPage> {
    return apiGet("/settings/audit-logs", params as Record<string, unknown>);
  },
};
