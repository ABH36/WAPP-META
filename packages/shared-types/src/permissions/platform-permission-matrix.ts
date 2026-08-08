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
