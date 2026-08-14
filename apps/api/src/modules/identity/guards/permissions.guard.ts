import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { getPermissionLevel, Permission, PermissionLevel } from "@wapp/shared-types";
import { REQUIRED_PERMISSION_KEY } from "../decorators/require-permission.decorator.js";
import type { RequestWithUser } from "./jwt-auth.guard.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

/**
 * Applied after JwtAuthGuard (which must run first — this guard trusts
 * `request.user` is already populated). Fails closed: a user with no role
 * yet (no Workspace — see User schema doc comment) can never satisfy a
 * `@RequirePermission()` check, which is the correct default until the
 * Workspace module assigns one.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly metricsService: MetricsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<Permission | undefined>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const role = request.user?.role;

    if (!role) {
      this.deny(request.user?.userId, requiredPermission);
    }

    const level = getPermissionLevel(role, requiredPermission);
    if (level === PermissionLevel.NONE) {
      this.deny(request.user?.userId, requiredPermission);
    }

    return true;
  }

  /**
   * PHD-001 Volume-2 §4.11 — Security Event Logging. Previously silent (a
   * `ForbiddenException` is an `HttpException`, so the global filter's
   * error-logging branch never fired for it). Deliberately a structured log
   * line + metric, not a new durable audit-collection write or domain
   * event — this mirrors the same "Identity's own security signals stay
   * out of the event-driven audit projection" decision already frozen for
   * LOGIN_SUCCESS/LOGIN_FAILED (see `domain-events.ts`'s own doc comment) —
   * the mixin-based logger already attaches correlation/user/workspace
   * context to this line (`logging.module.ts`), which is the audit trail
   * for this event class.
   */
  private deny(userId: string | undefined, permission: Permission): never {
    this.metricsService.securityPermissionDeniedTotal.inc({ actor: "tenant" });
    this.logger.warn(
      `Permission denied${userId ? ` for user ${userId}` : ""} — required "${permission}"`,
    );
    throw new ForbiddenException("You do not have permission to perform this action");
  }
}
