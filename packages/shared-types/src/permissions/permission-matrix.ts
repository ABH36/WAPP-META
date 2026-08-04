import { TenantRole } from "../enums/role.enum";
import { Permission, PermissionLevel } from "./permission.enum";

/**
 * THE canonical Role × Permission matrix — PRD-000C v1.1 §Section C, "the official
 * Business Permission Reference for Phase-1."
 *
 * This is consumed by:
 *  - apps/api's Identity Service (Capability Authorization, Stage 3 of the
 *    request lifecycle — SAD-001 Volume-2 §6 / TAD-001 v1.2 PATCH-003 AUTH-005)
 *  - apps/web's UI to conditionally render actions the current user cannot perform
 *
 * Do not duplicate this table anywhere else. If a permission decision looks wrong
 * for a screen you're building, the fix belongs here, traced to a new Business
 * Decision — not a local override in a component or controller.
 */
export const PERMISSION_MATRIX: Readonly<
  Record<Permission, Readonly<Record<TenantRole, PermissionLevel>>>
> = {
  [Permission.VIEW_WORKSPACE]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.VIEW_ONLY,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.VIEW_ONLY,
  },
  [Permission.EDIT_WORKSPACE]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.INVITE_USER]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.REMOVE_USER]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.MANAGE_ROLES]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.CONNECT_WHATSAPP]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.DISCONNECT_WHATSAPP]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.VIEW_CUSTOMERS]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.FULL,
  },
  [Permission.CREATE_CUSTOMER]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.VIEW_ONLY,
  },
  [Permission.EDIT_CUSTOMER]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.VIEW_ONLY,
  },
  [Permission.VIEW_LEADS]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.VIEW_ONLY,
  },
  [Permission.CREATE_LEADS]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.UPDATE_LEAD_STAGE]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.CONVERT_LEADS]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.VIEW_DEALS]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.VIEW_ONLY,
  },
  [Permission.CREATE_DEALS]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.CLOSE_DEALS]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.ASSIGN_CONVERSATIONS]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.REPLY_CONVERSATIONS]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.FULL,
  },
  [Permission.ADD_INTERNAL_NOTES]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.FULL,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.FULL,
  },
  [Permission.VIEW_TEMPLATES]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.CREATE_TEMPLATES]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.MANAGE_TEMPLATES]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.VIEW_BROADCASTS]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.CREATE_BROADCAST]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.SEND_BROADCAST]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.FULL,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
  [Permission.VIEW_REPORTS]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.FULL,
    [TenantRole.SALES_MANAGER]: PermissionLevel.TEAM_SCOPED,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.OWN_SCOPED,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.CAMPAIGN_SCOPED,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.TEAM_SCOPED,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.OWN_SCOPED,
  },
  [Permission.BILLING_ACCESS]: {
    [TenantRole.OWNER]: PermissionLevel.FULL,
    [TenantRole.ADMINISTRATOR]: PermissionLevel.VIEW_ONLY,
    [TenantRole.SALES_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SALES_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.MARKETING_EXECUTIVE]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_MANAGER]: PermissionLevel.NONE,
    [TenantRole.SUPPORT_EXECUTIVE]: PermissionLevel.NONE,
  },
};

/**
 * Pure helper — safe to use identically on the server (Identity Service, Stage 3
 * Capability Authorization) and the client (conditional rendering only; the
 * server check is what's authoritative, per SAD-001 Volume-2 §6).
 */
export function getPermissionLevel(role: TenantRole, permission: Permission): PermissionLevel {
  return PERMISSION_MATRIX[permission][role];
}

export function hasFullAccess(role: TenantRole, permission: Permission): boolean {
  return getPermissionLevel(role, permission) === PermissionLevel.FULL;
}

export function hasAnyAccess(role: TenantRole, permission: Permission): boolean {
  return getPermissionLevel(role, permission) !== PermissionLevel.NONE;
}
