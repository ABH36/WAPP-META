import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { PlatformPermission, PlatformRole } from "@wapp/shared-types";
import { PlatformPermissionsGuard } from "./platform-permissions.guard.js";
import type { RequestWithPlatformUser } from "./platform-auth.guard.js";

function fakeContext(role: PlatformRole | undefined): ExecutionContext {
  const request = {
    platformUser: role ? { platformUserId: "platform-user-1", role } : undefined,
  } as unknown as RequestWithPlatformUser;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("PlatformPermissionsGuard", () => {
  it("allows the request when the route has no required permission", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new PlatformPermissionsGuard(reflector);

    expect(guard.canActivate(fakeContext(PlatformRole.PLATFORM_SUPPORT_EXECUTIVE))).toBe(true);
  });

  it("allows a PLATFORM_SUPER_ADMIN to perform a MANAGE_* action", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(PlatformPermission.MANAGE_PLATFORM_USERS),
    } as unknown as Reflector;
    const guard = new PlatformPermissionsGuard(reflector);

    expect(guard.canActivate(fakeContext(PlatformRole.PLATFORM_SUPER_ADMIN))).toBe(true);
  });

  it("rejects a PLATFORM_SUPPORT_EXECUTIVE attempting MANAGE_PLATFORM_USERS", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(PlatformPermission.MANAGE_PLATFORM_USERS),
    } as unknown as Reflector;
    const guard = new PlatformPermissionsGuard(reflector);

    expect(() => guard.canActivate(fakeContext(PlatformRole.PLATFORM_SUPPORT_EXECUTIVE))).toThrow(
      ForbiddenException,
    );
  });

  it("rejects when request.platformUser is missing (guard ordering violated)", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(PlatformPermission.VIEW_WORKSPACES),
    } as unknown as Reflector;
    const guard = new PlatformPermissionsGuard(reflector);

    expect(() => guard.canActivate(fakeContext(undefined))).toThrow(ForbiddenException);
  });
});
