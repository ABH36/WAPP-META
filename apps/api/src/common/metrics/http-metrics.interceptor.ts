import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { MetricsService } from "./metrics.service.js";

/**
 * PHD-001 Volume-2 §4.3 "HTTP" — Request Count/Latency/Error Rate for every
 * request. `route.path` (Express's own parameterized-route pattern, e.g.
 * `/workspaces/:id`, not the literal URL) keeps the `route` label's
 * cardinality bounded regardless of how many distinct IDs are ever
 * requested — the same cardinality discipline `MetricsService`'s own doc
 * comment already applies to `workspaceId`.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    const record = (): void => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route = (request.route as { path?: string } | undefined)?.path ?? request.path;
      const labels = {
        method: request.method,
        route,
        status: String(response.statusCode),
      };
      this.metricsService.httpRequestsTotal.inc(labels);
      this.metricsService.httpRequestDurationSeconds.observe(labels, durationSeconds);
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
