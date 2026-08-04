import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { ApiResponseMeta, ApiSuccessResponse } from "@wapp/shared-types";

export interface Paginated<T> {
  items: T[];
  meta: ApiResponseMeta;
}

/**
 * Wraps every successful controller return value in the standard envelope
 * (TAD-001 API-002 / v1.1 PATCH-002). Controllers return plain data — or a
 * `Paginated<T>` shape for collection endpoints — and never construct the
 * envelope themselves, so it can never drift between endpoints.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((result) => {
        const isPaginated =
          result !== null &&
          typeof result === "object" &&
          "items" in (result as object) &&
          "meta" in (result as object);

        if (isPaginated) {
          const { items, meta } = result as unknown as Paginated<unknown>;
          return {
            success: true,
            message: "Request successful",
            data: items,
            meta,
          } as ApiSuccessResponse<T>;
        }

        return {
          success: true,
          message: "Request successful",
          data: result,
        };
      }),
    );
  }
}
