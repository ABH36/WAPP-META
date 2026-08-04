/**
 * Traces to: PRD-000C v1.1 (Role Permission Matrix), ADR-032 (naming convention —
 * "Platform" prefix is MANDATORY in all UI, audit logs, notifications, reports and
 * documentation whenever referring to WAPP internal employees. Never omit it —
 * TenantRole.SUPPORT_MANAGER and PlatformRole.PLATFORM_SUPPORT_MANAGER are
 * different roles at different organizational layers; conflating them is exactly
 * the ambiguity ADR-032 exists to prevent).
 */
export enum TenantRole {
  OWNER = "OWNER",
  ADMINISTRATOR = "ADMINISTRATOR",
  SALES_MANAGER = "SALES_MANAGER",
  SALES_EXECUTIVE = "SALES_EXECUTIVE",
  MARKETING_EXECUTIVE = "MARKETING_EXECUTIVE",
  SUPPORT_MANAGER = "SUPPORT_MANAGER",
  SUPPORT_EXECUTIVE = "SUPPORT_EXECUTIVE",
}

/** Platform Billing Executive was removed for Phase-1 (ADR-036) — do not add it back
 *  without a new Business Decision. */
export enum PlatformRole {
  PLATFORM_SUPER_ADMIN = "PLATFORM_SUPER_ADMIN",
  PLATFORM_SUPPORT_MANAGER = "PLATFORM_SUPPORT_MANAGER",
  PLATFORM_SUPPORT_EXECUTIVE = "PLATFORM_SUPPORT_EXECUTIVE",
}
