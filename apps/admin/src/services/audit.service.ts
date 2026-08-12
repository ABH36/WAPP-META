import { apiGet } from "../lib/api";
import type { PlatformAuditEntrySummary } from "../types/platform";

export interface ListPlatformAuditParams {
  workspaceId?: string;
  eventType?: string;
  page?: number;
  limit?: number;
}

interface PlatformAuditPage {
  items: PlatformAuditEntrySummary[];
  total: number;
}

/**
 * FRD-001 Volume-8 §4.7 — Global Audit Center. `VIEW_GLOBAL_AUDIT`.
 * Filters by raw `eventType` string and `workspaceId` only — no
 * `category` param exists. Only Break-Glass + a curated subset of
 * Platform Actions are natively persisted here; Billing Operations and
 * Workspace Actions live in their own owners' audit trails and are never
 * merged into this endpoint's response (Architecture Review, 2026-08-12:
 * no client-side event merging or synthetic timeline shall be introduced).
 */
export const auditService = {
  list(params: ListPlatformAuditParams): Promise<PlatformAuditPage> {
    return apiGet("/platform/audit", params as Record<string, unknown>);
  },
};
