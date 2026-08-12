import { apiGet, apiPatch } from "../lib/api";
import type {
  GovernancePolicyKey,
  GovernancePolicySummary,
  PlatformComplianceSnapshot,
} from "../types/platform";

/**
 * FRD-001 Volume-8 §4.8 — Governance & Compliance. `MANAGE_PLATFORM_POLICIES`
 * gates both read and write on Policies (these are the platform's own
 * security configuration values) — `VIEW_COMPLIANCE` gates the separate
 * Compliance snapshot. No "Violations" endpoint or concept exists
 * anywhere (dropped entirely, Architecture Review, 2026-08-12). Runtime
 * enforcement of these policies is tracked as open TD-024 — a policy
 * written here has no effect on any real system behavior yet.
 */
export const governanceService = {
  listPolicies(): Promise<GovernancePolicySummary[]> {
    return apiGet("/platform/policies");
  },

  updatePolicy(
    key: GovernancePolicyKey,
    value: Record<string, unknown>,
    reason: string,
  ): Promise<GovernancePolicySummary> {
    return apiPatch(`/platform/policies/${key}`, { value, reason });
  },

  compliance(): Promise<PlatformComplianceSnapshot> {
    return apiGet("/platform/compliance");
  },
};
