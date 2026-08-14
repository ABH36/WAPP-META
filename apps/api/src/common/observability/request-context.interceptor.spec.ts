import { of } from "rxjs";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { RequestContextInterceptor } from "./request-context.interceptor.js";
import { CorrelationContextService } from "./correlation-context.service.js";
import { requestContextStorage } from "./request-context.storage.js";

function fakeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const passthroughHandler: CallHandler = { handle: () => of(undefined) };

describe("RequestContextInterceptor", () => {
  let correlationContext: CorrelationContextService;
  let interceptor: RequestContextInterceptor;

  beforeEach(() => {
    correlationContext = new CorrelationContextService();
    interceptor = new RequestContextInterceptor(correlationContext);
  });

  it("writes userId/workspaceId into the active context for an authenticated tenant user", () => {
    correlationContext.run("corr-1", () => {
      interceptor
        .intercept(
          fakeContext({ user: { userId: "user-1", workspaceId: "workspace-1" } }),
          passthroughHandler,
        )
        .subscribe();

      expect(requestContextStorage.getStore()).toEqual({
        correlationId: "corr-1",
        userId: "user-1",
        workspaceId: "workspace-1",
      });
    });
  });

  it("omits workspaceId when the authenticated user has none", () => {
    correlationContext.run("corr-1", () => {
      interceptor
        .intercept(
          fakeContext({ user: { userId: "user-1", workspaceId: null } }),
          passthroughHandler,
        )
        .subscribe();

      expect(requestContextStorage.getStore()).toEqual({
        correlationId: "corr-1",
        userId: "user-1",
        workspaceId: undefined,
      });
    });
  });

  it("writes platformUserId into the active context for an authenticated platform user", () => {
    correlationContext.run("corr-1", () => {
      interceptor
        .intercept(
          fakeContext({ platformUser: { platformUserId: "platform-1" } }),
          passthroughHandler,
        )
        .subscribe();

      expect(requestContextStorage.getStore()).toEqual({
        correlationId: "corr-1",
        platformUserId: "platform-1",
      });
    });
  });

  it("leaves the context untouched on a @Public() route with neither user attached", () => {
    correlationContext.run("corr-1", () => {
      interceptor.intercept(fakeContext({}), passthroughHandler).subscribe();

      expect(requestContextStorage.getStore()).toEqual({ correlationId: "corr-1" });
    });
  });

  it("always calls through to the next handler", () => {
    const handle = jest.fn().mockReturnValue(of(undefined));
    interceptor.intercept(fakeContext({}), { handle }).subscribe();

    expect(handle).toHaveBeenCalled();
  });
});
