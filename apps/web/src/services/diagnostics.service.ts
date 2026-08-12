import { apiGet } from "../lib/api";
import type { DiagnosticsSummary } from "../types/settings";

/** FRD-001 Volume-7 §4.12 — `VIEW_REPORTS` (deliberately looser than Audit's `EDIT_WORKSPACE` — read-only infra health, not security-sensitive). Read-only, no mutation route exists. */
export const diagnosticsService = {
  get(): Promise<DiagnosticsSummary> {
    return apiGet("/settings/diagnostics");
  },
};
