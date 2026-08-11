import { Permission, PermissionLevel, getPermissionLevel, hasAnyAccess } from "@wapp/shared-types";
import { useAuthStore } from "../stores/auth-store";

/**
 * FRD-001 Volume-3 §17 — the first client-side consumer of
 * `PERMISSION_MATRIX` (`packages/shared-types`), whose own doc comment
 * already names this exact use case ("apps/web's UI to conditionally
 * render actions the current user cannot perform"). Reuses the package's
 * own `getPermissionLevel`/`hasAnyAccess` helpers rather than indexing
 * `PERMISSION_MATRIX` directly, so the lookup logic itself is never
 * duplicated. Matches BR-004 (ADR-FE-001) — this is convenience rendering
 * only; the backend's own `@RequirePermission` guard remains the sole
 * authority, and every call site still has to handle a 403 that reaches
 * it regardless (a stale role in a not-yet-refreshed session, for
 * example).
 */
export function usePermissionLevel(permission: Permission): PermissionLevel {
  const role = useAuthStore((s) => s.user?.role);
  if (!role) {
    return PermissionLevel.NONE;
  }
  return getPermissionLevel(role, permission);
}

export function useHasPermission(permission: Permission): boolean {
  const role = useAuthStore((s) => s.user?.role);
  if (!role) {
    return false;
  }
  return hasAnyAccess(role, permission);
}

/**
 * FRD-001 Volume-4 — write actions (create/edit/send) must check for
 * `FULL` specifically, not just "not NONE." The backend's permission
 * guard (`permissions.guard.ts`) only checks `level !== NONE`, so a
 * `VIEW_ONLY` role (e.g. `SALES_MANAGER` on Templates/Broadcasts/
 * Campaigns) isn't actually blocked server-side from calling a write
 * route directly — only the frontend prevents it (Architecture Review,
 * 2026-08-11: "View-only users shall never receive create, edit or send
 * actions"). `useHasPermission` alone is still correct for gating
 * read/view access.
 */
export function useHasFullPermission(permission: Permission): boolean {
  return usePermissionLevel(permission) === PermissionLevel.FULL;
}

/**
 * FRD-001 Volume-5 §4.6/§4.7/§4.8 — Activities have no permission of
 * their own (`ActivityController` has zero `@RequirePermission`
 * decorators, ADR-CRM-016/017). Access is derived from whichever
 * `customerId`/`dealId` a specific Activity references — if both are
 * set, the backend requires **both** underlying permissions (AND, not
 * OR), never just one. These hooks mirror that exact rule so the
 * frontend never shows a control the backend would reject.
 */
export function useActivityViewPermission(
  customerId: string | null,
  dealId: string | null,
): boolean {
  const canViewCustomers = useHasPermission(Permission.VIEW_CUSTOMERS);
  const canViewDeals = useHasPermission(Permission.VIEW_DEALS);
  if (customerId && dealId) return canViewCustomers && canViewDeals;
  if (customerId) return canViewCustomers;
  if (dealId) return canViewDeals;
  return false;
}

export function useActivityEditPermission(
  customerId: string | null,
  dealId: string | null,
): boolean {
  const canEditCustomers = useHasFullPermission(Permission.EDIT_CUSTOMER);
  const canCreateDeals = useHasFullPermission(Permission.CREATE_DEALS);
  if (customerId && dealId) return canEditCustomers && canCreateDeals;
  if (customerId) return canEditCustomers;
  if (dealId) return canCreateDeals;
  return false;
}
