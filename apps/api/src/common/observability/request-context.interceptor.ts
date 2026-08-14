import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Observable } from "rxjs";
import type { AuthenticatedUser } from "../../modules/identity/identity.types.js";
import type { AuthenticatedPlatformUser } from "../../modules/platform/platform.types.js";
import { CorrelationContextService } from "./correlation-context.service.js";

interface RequestWithAuthContext {
  user?: AuthenticatedUser;
  platformUser?: AuthenticatedPlatformUser;
}

/**
 * PHD-001 Volume-2 §4.1 — interceptors run after guards in Nest's request
 * pipeline, so by the time this fires, `JwtAuthGuard`/`PlatformAuthGuard`
 * have already attached `request.user`/`request.platformUser` (on
 * authenticated routes; both stay undefined on `@Public()` ones). Writes
 * into the same `CorrelationContextService` store the correlation ID
 * already lives in, so every log line for the rest of this request —
 * including ones from deep in the service layer — carries User ID/
 * Workspace ID/Platform User ID without them being threaded through every
 * function signature by hand.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly correlationContext: CorrelationContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithAuthContext>();

    if (request.user) {
      this.correlationContext.setUserContext({
        userId: request.user.userId,
        workspaceId: request.user.workspaceId ?? undefined,
      });
    } else if (request.platformUser) {
      this.correlationContext.setUserContext({
        platformUserId: request.platformUser.platformUserId,
      });
    }

    return next.handle();
  }
}
