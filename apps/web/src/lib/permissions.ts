import {
  PermissionLevel,
  getPermissionLevel,
  hasAnyAccess,
  type Permission,
} from "@wapp/shared-types";
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
