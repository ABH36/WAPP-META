import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { MetricsAuthGuard } from "./metrics-auth.guard.js";
import type { AppConfig } from "../../config/configuration.js";

function contextWithAuthHeader(authorization: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as unknown as ExecutionContext;
}

describe("MetricsAuthGuard", () => {
  let config: ConfigService<AppConfig, true>;

  beforeEach(() => {
    config = {
      get: jest.fn().mockReturnValue({ metricsAuthToken: "correct-token" }),
    } as unknown as ConfigService<AppConfig, true>;
  });

  it("allows access with the correct bearer token", () => {
    const guard = new MetricsAuthGuard(config);
    expect(guard.canActivate(contextWithAuthHeader("Bearer correct-token"))).toBe(true);
  });

  it("rejects a missing Authorization header", () => {
    const guard = new MetricsAuthGuard(config);
    expect(() => guard.canActivate(contextWithAuthHeader(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it("rejects a header that isn't a Bearer token", () => {
    const guard = new MetricsAuthGuard(config);
    expect(() => guard.canActivate(contextWithAuthHeader("Basic correct-token"))).toThrow(
      UnauthorizedException,
    );
  });

  it("rejects an incorrect token of the same length", () => {
    const guard = new MetricsAuthGuard(config);
    expect(() => guard.canActivate(contextWithAuthHeader("Bearer wrong-token"))).toThrow(
      UnauthorizedException,
    );
  });

  it("rejects a token of a different length without throwing from timingSafeEqual", () => {
    const guard = new MetricsAuthGuard(config);
    expect(() => guard.canActivate(contextWithAuthHeader("Bearer short"))).toThrow(
      UnauthorizedException,
    );
  });
});
