import type { Response } from "express";
import { MetricsController } from "./metrics.controller.js";
import { MetricsService } from "./metrics.service.js";

describe("MetricsController", () => {
  it("sets the Content-Type from the registry and returns the Prometheus text exposition", async () => {
    const metricsService = new MetricsService();
    const controller = new MetricsController(metricsService);
    const setHeader = jest.fn();
    const response = { setHeader } as unknown as Response;

    const body = await controller.getMetrics(response);

    expect(setHeader).toHaveBeenCalledWith("Content-Type", metricsService.registry.contentType);
    expect(body).toContain("wapp_http_requests_total");
  });
});
