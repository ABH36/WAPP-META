/**
 * FRD-001 Volume-2 §4.6/§10 — friendly-copy mapping for the backend's own
 * internal `reason` strings (`AuthService`'s literal values, confirmed via
 * architecture review: INVALID_CREDENTIALS, ACCOUNT_LOCKED, ACCOUNT_INACTIVE,
 * EMAIL_NOT_VERIFIED, PLATFORM_MAINTENANCE_MODE, WORKSPACE_ACCESS_SUSPENDED,
 * WORKSPACE_ACCESS_REMOVED, WORKSPACE_SUSPENDED_OR_ARCHIVED,
 * WORKSPACE_MAINTENANCE_MODE, or null on success). Never displayed verbatim
 * — these are internal codes, not user-facing copy.
 */
const REASON_LABELS: Record<string, string> = {
  INVALID_CREDENTIALS: "Incorrect email or password",
  ACCOUNT_LOCKED: "Account temporarily locked",
  ACCOUNT_INACTIVE: "Account disabled",
  EMAIL_NOT_VERIFIED: "Email not verified",
  PLATFORM_MAINTENANCE_MODE: "Platform under maintenance",
  WORKSPACE_ACCESS_SUSPENDED: "Workspace access suspended",
  WORKSPACE_ACCESS_REMOVED: "Workspace access removed",
  WORKSPACE_SUSPENDED_OR_ARCHIVED: "Workspace suspended",
  WORKSPACE_MAINTENANCE_MODE: "Workspace under maintenance",
};

export function formatLoginReason(reason: string | null, success: boolean): string {
  if (success) return "Successful login";
  if (!reason) return "Failed login";
  return REASON_LABELS[reason] ?? "Failed login";
}
