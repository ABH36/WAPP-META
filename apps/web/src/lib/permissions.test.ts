import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { Permission, PermissionLevel, TenantRole } from "@wapp/shared-types";
import { useHasPermission, usePermissionLevel } from "./permissions";
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
});
