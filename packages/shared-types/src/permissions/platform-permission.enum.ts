/**
 * PRD-007 Volume-1 §7 — platform-level permissions, fully independent of
 * the tenant `Permission` enum/`PERMISSION_MATRIX`. Do not add a permission
 * here without an approved Business Decision (same discipline as
 * `permission.enum.ts`).
 */
export enum PlatformPermission {
  VIEW_PLATFORM_DASHBOARD = "VIEW_PLATFORM_DASHBOARD",
  VIEW_WORKSPACES = "VIEW_WORKSPACES",
  MANAGE_WORKSPACE_STATUS = "MANAGE_WORKSPACE_STATUS",
  MANAGE_PLATFORM_USERS = "MANAGE_PLATFORM_USERS",
  MANAGE_ANNOUNCEMENTS = "MANAGE_ANNOUNCEMENTS",
  MANAGE_PLATFORM_FEATURE_FLAGS = "MANAGE_PLATFORM_FEATURE_FLAGS",
  VIEW_PLATFORM_SEARCH = "VIEW_PLATFORM_SEARCH",
  MANAGE_PLATFORM_MAINTENANCE = "MANAGE_PLATFORM_MAINTENANCE",
}
