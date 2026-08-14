import { firstValueFrom, of, throwError } from "rxjs";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { HttpMetricsInterceptor } from "./http-metrics.interceptor.js";
import { MetricsService } from "./metrics.service.js";

function fakeContext(
  request: Record<string, unknown>,
  response: Record<string, unknown>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function handlerReturning(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

function handlerThrowing(error: unknown): CallHandler {
  return { handle: () => throwError(() => error) };
}

describe("HttpMetricsInterceptor", () => {
  let metricsService: MetricsService;
  let interceptor: HttpMetricsInterceptor;

  beforeEach(() => {
    metricsService = new MetricsService();
    interceptor = new HttpMetricsInterceptor(metricsService);
  });

  it("records a request using the parameterized route pattern, not the literal URL", async () => {
    const request = {
      method: "GET",
      path: "/workspaces/abc123",
      route: { path: "/workspaces/:id" },
    };
    const response = { statusCode: 200 };

    await firstValueFrom(
      interceptor.intercept(fakeContext(request, response), handlerReturning({ ok: true })),
    );

    const metric = await metricsService.registry.getSingleMetricAsString(
      "wapp_http_requests_total",
    );
    expect(metric).toMatch(
      /wapp_http_requests_total\{method="GET",route="\/workspaces\/:id",status="200"\} 1/,
    );
  });

  it("falls back to request.path when Express hasn't resolved a route (e.g. a 404)", async () => {
    const request = { method: "GET", path: "/does-not-exist", route: undefined };
    const response = { statusCode: 404 };

    await firstValueFrom(
      interceptor.intercept(fakeContext(request, response), handlerReturning(null)),
    );

    const metric = await metricsService.registry.getSingleMetricAsString(
      "wapp_http_requests_total",
    );
    expect(metric).toContain('route="/does-not-exist"');
  });

  it("still records the request when the handler errors", async () => {
    const request = {
      method: "POST",
      path: "/billing/payments",
      route: { path: "/billing/payments" },
    };
    const response = { statusCode: 500 };

    await expect(
      firstValueFrom(
        interceptor.intercept(fakeContext(request, response), handlerThrowing(new Error("boom"))),
      ),
    ).rejects.toThrow("boom");

    const metric = await metricsService.registry.getSingleMetricAsString(
      "wapp_http_requests_total",
    );
    expect(metric).toContain('status="500"');
  });
});
