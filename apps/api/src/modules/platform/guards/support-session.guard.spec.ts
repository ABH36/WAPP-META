import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { SupportSessionGuard } from "./support-session.guard.js";
import type { PlatformSupportSessionsService } from "../services/platform-support-sessions.service.js";
import type { RequestWithPlatformUser } from "./platform-auth.guard.js";

function fakeContext(
  params: Record<string, string>,
  query: Record<string, string>,
  platformUserId: string | undefined,
): ExecutionContext {
  const request = {
    params,
    query,
    platformUser: platformUserId ? { platformUserId, role: "PLATFORM_SUPER_ADMIN" } : undefined,
  } as unknown as RequestWithPlatformUser;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("SupportSessionGuard", () => {
  let service: jest.Mocked<PlatformSupportSessionsService>;
  let guard: SupportSessionGuard;

  beforeEach(() => {
    service = {
      ensureActiveAccess: jest.fn(),
    } as unknown as jest.Mocked<PlatformSupportSessionsService>;
    guard = new SupportSessionGuard(service);
  });

  it("reads the workspace id from the route param (:id) and allows when an active session exists", async () => {
    service.ensureActiveAccess.mockResolvedValue(undefined);
    const context = fakeContext({ id: "workspace-1" }, {}, "super-1");

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(service.ensureActiveAccess).toHaveBeenCalledWith("workspace-1", "super-1");
  });

  it("reads the workspace id from the query string when no route param exists", async () => {
    service.ensureActiveAccess.mockResolvedValue(undefined);
    const context = fakeContext({}, { workspaceId: "workspace-1" }, "super-1");

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(service.ensureActiveAccess).toHaveBeenCalledWith("workspace-1", "super-1");
  });

  it("rejects when no workspace id is present at all", async () => {
    const context = fakeContext({}, {}, "super-1");

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(service.ensureActiveAccess).not.toHaveBeenCalled();
  });

  it("rejects when request.platformUser is missing (guard ordering violated)", async () => {
    const context = fakeContext({ id: "workspace-1" }, {}, undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(service.ensureActiveAccess).not.toHaveBeenCalled();
  });

  it("propagates the service's ForbiddenException when no active session exists", async () => {
    service.ensureActiveAccess.mockRejectedValue(new ForbiddenException("no active session"));
    const context = fakeContext({ id: "workspace-1" }, {}, "super-1");

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
