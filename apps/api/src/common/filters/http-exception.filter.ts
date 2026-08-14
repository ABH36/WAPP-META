import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import type { Request, Response } from "express";
import type { ApiErrorResponse, ApiFieldError } from "@wapp/shared-types";
import { ErrorReportingService } from "../observability/error-reporting.service.js";
import { MetricsService } from "../metrics/metrics.service.js";

/**
 * Global exception filter — implements TAD-001 API-002 (error envelope) and
 * ERR-001/ERR-002 (never expose stack traces, DB queries, internal paths, or
 * secrets). Every unhandled exception is funneled through here, so there is
 * exactly one place response shape and log redaction is enforced.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  constructor(
    private readonly errorReporting: ErrorReportingService,
    private readonly metricsService: MetricsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, errors } = this.resolveErrorBody(exception, isHttpException);

    // ERR-003 — unexpected (non-HttpException) exceptions are logged centrally with
    // full detail server-side; the client only ever receives the sanitized message above.
    if (!isHttpException) {
      this.logger.error(exception instanceof Error ? exception.stack : JSON.stringify(exception));
      // PHD-001 Volume-2 §4.5 — the same "unexpected error" signal this
      // logger call already captures, also handed to the pluggable
      // error-reporting abstraction (a no-op that still logs today; a real
      // provider swaps in later with zero changes here).
      this.errorReporting.captureException(exception);
    } else if (exception instanceof ThrottlerException) {
      // PHD-001 Volume-2 §4.11 — Security Event Logging. Previously silent
      // (ThrottlerException IS an HttpException, so the branch above never
      // fired for it): a 429 produced no log line and no metric at all.
      // Targeted here rather than a second global `@Catch(ThrottlerException)`
      // filter — with `HttpExceptionFilter` already registered as the sole
      // `APP_FILTER`, a second global filter's relative execution order
      // against this one isn't worth the fragility for one extra branch.
      const request = ctx.getRequest<Request>();
      const route = (request.route as { path?: string } | undefined)?.path ?? request.path;
      this.metricsService.securityRateLimitViolationTotal.inc({ route });
      this.logger.warn(`Rate limit exceeded on ${request.method} ${route}`);
    }

    const body: ApiErrorResponse = {
      success: false,
      message,
      data: null,
      errors,
    };

    response.status(status).json(body);
  }

  private resolveErrorBody(
    exception: unknown,
    isHttpException: boolean,
  ): { message: string; errors: ApiFieldError[] } {
    if (isHttpException) {
      const response = (exception as HttpException).getResponse();

      if (typeof response === "string") {
        return { message: response, errors: [] };
      }

      const body = response as { message?: string | string[]; error?: string };
      const rawMessage = body.message ?? body.error ?? "Request failed";

      if (Array.isArray(rawMessage)) {
        // class-validator produces an array of field-level messages.
        return {
          message: "Validation failed",
          errors: rawMessage.map((message) => ({ message })),
        };
      }

      return { message: rawMessage, errors: [] };
    }

    // Never leak the raw exception message for unexpected errors — ERR-002.
    return { message: "An unexpected error occurred. Please try again.", errors: [] };
  }
}
