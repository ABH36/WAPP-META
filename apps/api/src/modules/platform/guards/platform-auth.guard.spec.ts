import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { PlatformRole } from "@wapp/shared-types";
import { PlatformAuthGuard, type RequestWithPlatformUser } from "./platform-auth.guard.js";
import type { PlatformTokenService } from "../services/platform-token.service.js";

function fakeContext(headers: Record<string, string> = {}): {
  context: ExecutionContext;
  request: RequestWithPlatformUser;
} {
  const request = { headers } as unknown as RequestWithPlatformUser;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe("PlatformAuthGuard", () => {
  let tokenService: jest.Mocked<PlatformTokenService>;
  let guard: PlatformAuthGuard;

  beforeEach(() => {
    tokenService = { verifyAccessToken: jest.fn() } as unknown as jest.Mocked<PlatformTokenService>;
    guard = new PlatformAuthGuard(tokenService);
  });

  it("rejects a request with no Authorization header", () => {
    const { context } = fakeContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects a non-Bearer Authorization header", () => {
    const { context } = fakeContext({ authorization: "Basic abc123" });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("verifies the bearer token and populates request.platformUser", () => {
    tokenService.verifyAccessToken.mockReturnValue({
      sub: "platform-user-1",
      role: PlatformRole.PLATFORM_SUPER_ADMIN,
      type: "platform_access",
    });
    const { context, request } = fakeContext({ authorization: "Bearer a-real-token" });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith("a-real-token");
    expect(request.platformUser).toEqual({
      platformUserId: "platform-user-1",
      role: PlatformRole.PLATFORM_SUPER_ADMIN,
    });
  });

  it("propagates a rejection from an invalid/expired token", () => {
    tokenService.verifyAccessToken.mockImplementation(() => {
      throw new UnauthorizedException("Invalid or expired access token");
    });
    const { context } = fakeContext({ authorization: "Bearer bad-token" });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
