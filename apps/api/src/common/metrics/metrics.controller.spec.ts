import type { Response } from "express";
import { MetricsController } from "./metrics.controller.js";
import { MetricsService } from "./metrics.service.js";

describe("MetricsController", () => {
  // FINAL-QA-001 — this test used to call `controller.getMetrics(response)`
  // and assert on its *return value*, which is exactly why the bug it now
  // guards against went undetected: calling the controller method directly
  // bypasses Nest's real HTTP pipeline (including the global
  // ResponseInterceptor) entirely, so a unit test shaped this way could
  // never have caught the interceptor JSON-wrapping the response body even
  // though the method itself always returned the right string. Only
  // asserting on `response.send(...)`'s own argument (what actually goes
  // over the wire once `@Res()` takes full manual control, no
  // `passthrough`) tests the thing that was actually broken.
  it("sets the Content-Type from the registry and sends the raw Prometheus text exposition via response.send", async () => {
    const metricsService = new MetricsService();
    const controller = new MetricsController(metricsService);
    const setHeader = jest.fn<Response, [name: string, value: string]>();
    const send = jest.fn<Response, [body: string]>();
    const response = { setHeader, send } as unknown as Response;

    await controller.getMetrics(response);

    expect(setHeader).toHaveBeenCalledWith("Content-Type", metricsService.registry.contentType);
    expect(send).toHaveBeenCalledTimes(1);
    const [body] = send.mock.calls[0]!;
    expect(typeof body).toBe("string");
    expect(body).toContain("wapp_http_requests_total");
  });
});
