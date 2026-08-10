import { PlatformRole } from "../enums/role.enum";
import { PlatformPermission } from "./platform-permission.enum";
import { PermissionLevel } from "./permission.enum";

/**
 * THE canonical Platform Role × Permission matrix — fully independent of
 * `PERMISSION_MATRIX` (tenant), per PRD-007 Volume-1 §7 ("Workspace
 * Permission Matrix remains unchanged"). Follows the already-approved
 * ADR-034 shape: view-level actions are available to all three platform
 * roles; every mutating, high-blast-radius action (workspace status,
 * platform users, feature flags, platform maintenance) is restricted to
 * PLATFORM_SUPER_ADMIN only. Announcements is the one exception given FULL
 * to PLATFORM_SUPPORT_MANAGER too — operational coordination (e.g.
 * scheduled-maintenance notices) is a natural Support Manager duty, not
 * exclusively a Super Admin one.
 */
export const PLATFORM_PERMISSION_MATRIX: Readonly<
  Record<PlatformPermission, Readonly<Record<PlatformRole, PermissionLevel>>>
> = {
  [PlatformPermission.VIEW_PLATFORM_DASHBOARD]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.FULL,
  },
  [PlatformPermission.VIEW_WORKSPACES]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.FULL,
  },
  [PlatformPermission.MANAGE_WORKSPACE_STATUS]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.NONE,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [PlatformPermission.MANAGE_PLATFORM_USERS]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.NONE,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [PlatformPermission.MANAGE_ANNOUNCEMENTS]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.VIEW_ONLY,
  },
  [PlatformPermission.MANAGE_PLATFORM_FEATURE_FLAGS]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.NONE,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [PlatformPermission.VIEW_PLATFORM_SEARCH]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.FULL,
  },
  [PlatformPermission.MANAGE_PLATFORM_MAINTENANCE]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.NONE,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  // PRD-007 Volume-2 (Platform Billing Operations & Customer Support) —
  // Architecture Review, 2026-08-08: every money-touching action
  // (MANAGE_SUBSCRIPTIONS/MANAGE_PAYMENTS/MANAGE_TRIALS) stays
  // PLATFORM_SUPER_ADMIN-only; Support roles get VIEW_PLATFORM_BILLING and
  // MANAGE_SUPPORT (tickets) only.
  [PlatformPermission.VIEW_PLATFORM_BILLING]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.FULL,
  },
  [PlatformPermission.MANAGE_SUBSCRIPTIONS]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.NONE,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [PlatformPermission.MANAGE_PAYMENTS]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.NONE,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [PlatformPermission.MANAGE_TRIALS]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.NONE,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [PlatformPermission.MANAGE_SUPPORT]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.FULL,
  },
  // PRD-007 Volume-3 (Platform Support, Break-Glass Access & Global Audit) —
  // Architecture Review, 2026-08-10: §6 "Break-Glass is available only to
  // PLATFORM_SUPER_ADMIN. Support roles may only request access." —
  // APPROVE_SUPPORT_ACCESS/START_SUPPORT_SESSION (the actions that actually
  // grant live cross-tenant access) are Super-Admin-only; REQUEST_SUPPORT_
  // ACCESS and the two VIEW_* permissions follow the existing VIEW_*
  // precedent (FULL for all three roles).
  [PlatformPermission.REQUEST_SUPPORT_ACCESS]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.FULL,
  },
  [PlatformPermission.APPROVE_SUPPORT_ACCESS]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.NONE,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [PlatformPermission.START_SUPPORT_SESSION]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.NONE,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [PlatformPermission.VIEW_GLOBAL_AUDIT]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.FULL,
  },
  [PlatformPermission.VIEW_INVESTIGATION]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.FULL,
  },
  // PRD-007 Volume-4 (Platform Analytics, Governance & Compliance) —
  // Architecture Review, 2026-08-10: "VIEW_COMPLIANCE remains
  // PLATFORM_SUPER_ADMIN only. VIEW_PLATFORM_ANALYTICS and
  // EXPORT_PLATFORM_REPORTS may be granted to support roles.
  // MANAGE_PLATFORM_POLICIES remains PLATFORM_SUPER_ADMIN only." Compliance
  // data (Failed Login Attempts, Break-Glass Sessions) is materially more
  // sensitive than aggregate KPI counts, so it stays behind the same
  // Super-Admin-only bar as every other high-blast-radius permission —
  // MANAGE_PLATFORM_POLICIES additionally gates GET /platform/policies
  // (read), not just PATCH, since these are the platform's own security
  // configuration values.
  [PlatformPermission.VIEW_PLATFORM_ANALYTICS]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.FULL,
  },
  [PlatformPermission.VIEW_COMPLIANCE]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.NONE,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [PlatformPermission.MANAGE_PLATFORM_POLICIES]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.NONE,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [PlatformPermission.EXPORT_PLATFORM_REPORTS]: {
    [PlatformRole.PLATFORM_SUPER_ADMIN]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_MANAGER]: PermissionLevel.FULL,
    [PlatformRole.PLATFORM_SUPPORT_EXECUTIVE]: PermissionLevel.FULL,
  },
};

export function getPlatformPermissionLevel(
  role: PlatformRole,
  permission: PlatformPermission,
): PermissionLevel {
  return PLATFORM_PERMISSION_MATRIX[permission][role];
}

export function hasPlatformFullAccess(role: PlatformRole, permission: PlatformPermission): boolean {
  return getPlatformPermissionLevel(role, permission) === PermissionLevel.FULL;
}
