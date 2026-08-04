import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import type { ApiErrorResponse, ApiFieldError } from "@wapp/shared-types";

/**
 * Global exception filter — implements TAD-001 API-002 (error envelope) and
 * ERR-001/ERR-002 (never expose stack traces, DB queries, internal paths, or
 * secrets). Every unhandled exception is funneled through here, so there is
 * exactly one place response shape and log redaction is enforced.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

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
