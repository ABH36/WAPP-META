import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { Permission, PermissionLevel, TenantRole } from "@wapp/shared-types";
import {
  useActivityEditPermission,
  useActivityViewPermission,
  useHasFullPermission,
  useHasPermission,
  usePermissionLevel,
} from "./permissions";
import { useAuthStore } from "../stores/auth-store";

function setRole(role: TenantRole | null): void {
  useAuthStore.setState({
    user: role
      ? {
          id: "u1",
          fullName: "Test User",
          email: "test@example.com",
          mobileNumber: "+911234567890",
          workspaceId: "w1",
          role,
          workspaceMemberStatus: null,
          isEmailVerified: true,
          createdAt: new Date().toISOString(),
        }
      : null,
  });
}

describe("permissions", () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });

  it("returns NONE for BILLING_ACCESS when no user is set", () => {
    setRole(null);
    const { result } = renderHook(() => usePermissionLevel(Permission.BILLING_ACCESS));
    expect(result.current).toBe(PermissionLevel.NONE);
  });

  it("useHasPermission is false for a role with no access", () => {
    setRole(TenantRole.SALES_EXECUTIVE);
    const { result } = renderHook(() => useHasPermission(Permission.BILLING_ACCESS));
    expect(result.current).toBe(false);
  });

  it("useHasPermission is true for Owner on BILLING_ACCESS", () => {
    setRole(TenantRole.OWNER);
    const { result } = renderHook(() => useHasPermission(Permission.BILLING_ACCESS));
    expect(result.current).toBe(true);
  });

  it("useHasPermission is true for every role on VIEW_WORKSPACE", () => {
    setRole(TenantRole.SUPPORT_EXECUTIVE);
    const { result } = renderHook(() => useHasPermission(Permission.VIEW_WORKSPACE));
    expect(result.current).toBe(true);
  });

  it("useHasFullPermission is false for a VIEW_ONLY role (Sales Manager on Templates), even though useHasPermission is true", () => {
    setRole(TenantRole.SALES_MANAGER);
    const { result: full } = renderHook(() => useHasFullPermission(Permission.VIEW_TEMPLATES));
    const { result: any } = renderHook(() => useHasPermission(Permission.VIEW_TEMPLATES));
    expect(full.current).toBe(false);
    expect(any.current).toBe(true);
  });

  it("useHasFullPermission is true for a FULL role (Owner on Templates)", () => {
    setRole(TenantRole.OWNER);
    const { result } = renderHook(() => useHasFullPermission(Permission.VIEW_TEMPLATES));
    expect(result.current).toBe(true);
  });

  it("useActivityViewPermission checks only the referenced entity's permission when one ref is set", () => {
    // Marketing Executive: VIEW_CUSTOMERS=VIEW_ONLY, VIEW_DEALS=NONE.
    setRole(TenantRole.MARKETING_EXECUTIVE);
    const { result: customerOnly } = renderHook(() => useActivityViewPermission("c1", null));
    const { result: dealOnly } = renderHook(() => useActivityViewPermission(null, "d1"));
    expect(customerOnly.current).toBe(true);
    expect(dealOnly.current).toBe(false);
  });

  it("useActivityViewPermission requires BOTH permissions (AND) when both refs are set", () => {
    // Marketing Executive has VIEW_CUSTOMERS but not VIEW_DEALS — an
    // Activity referencing both a Customer and a Deal must be denied.
    setRole(TenantRole.MARKETING_EXECUTIVE);
    const { result } = renderHook(() => useActivityViewPermission("c1", "d1"));
    expect(result.current).toBe(false);
  });

  it("useActivityViewPermission is false when neither ref is set", () => {
    setRole(TenantRole.OWNER);
    const { result } = renderHook(() => useActivityViewPermission(null, null));
    expect(result.current).toBe(false);
  });

  it("useActivityEditPermission requires FULL, not just VIEW_ONLY, on the referenced entity's edit permission", () => {
    // Support Manager: EDIT_CUSTOMER=VIEW_ONLY (not FULL).
    setRole(TenantRole.SUPPORT_MANAGER);
    const { result } = renderHook(() => useActivityEditPermission("c1", null));
    expect(result.current).toBe(false);
  });

  it("useActivityEditPermission is true when both refs are set and both permissions are FULL", () => {
    setRole(TenantRole.OWNER);
    const { result } = renderHook(() => useActivityEditPermission("c1", "d1"));
    expect(result.current).toBe(true);
  });
});
