import {
  type PlatformPermission,
  PermissionLevel,
  getPlatformPermissionLevel,
  hasPlatformFullAccess,
} from "@wapp/shared-types";
import { useAuthStore } from "../stores/auth-store";

/**
 * FRD-001 Volume-8 §10 — the Platform Administration equivalent of
 * `apps/web`'s `lib/permissions.ts` (FRD-001 Volume-3). Reuses
 * `PLATFORM_PERMISSION_MATRIX`'s own `getPlatformPermissionLevel`/
 * `hasPlatformFullAccess` helpers rather than indexing the matrix
 * directly — fully independent of the tenant `Permission` system
 * (`ADR-PLAT-001`), never shares a hook, a store, or an import with
 * `apps/web`'s equivalent file. `useAuthStore`'s `PlatformUser` is the
 * thin `{platformUserId, role}` shape (see `types/auth.ts`), sufficient
 * for every permission check here since only `role` is ever needed.
 */
export function usePlatformPermissionLevel(permission: PlatformPermission): PermissionLevel {
  const role = useAuthStore((s) => s.user?.role);
  if (!role) {
    return PermissionLevel.NONE;
  }
  return getPlatformPermissionLevel(role, permission);
}

export function useHasPlatformPermission(permission: PlatformPermission): boolean {
  return usePlatformPermissionLevel(permission) !== PermissionLevel.NONE;
}

/**
 * Unlike Settings' `EDIT_WORKSPACE` (binary NONE/FULL only), several
 * Platform permissions have a genuine `VIEW_ONLY` tier (e.g.
 * `MANAGE_ANNOUNCEMENTS` grants `PLATFORM_SUPPORT_EXECUTIVE` `VIEW_ONLY`,
 * not `FULL`) — this distinction is load-bearing here, not just
 * defensive convention. Every write action (Suspend/Archive, Create
 * Platform User, Extend Trial, Void Invoice, Approve Break-Glass, Publish
 * Governance Policy, Toggle Feature Flag, Enable Maintenance, etc.) must
 * gate on this, never `useHasPlatformPermission` alone.
 */
export function useHasFullPlatformPermission(permission: PlatformPermission): boolean {
  const role = useAuthStore((s) => s.user?.role);
  if (!role) {
    return false;
  }
  return hasPlatformFullAccess(role, permission);
}
