import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  PermissionLevel,
  getPlatformPermissionLevel,
  type PlatformPermission,
} from "@wapp/shared-types";
import { REQUIRED_PLATFORM_PERMISSION_KEY } from "../decorators/require-platform-permission.decorator.js";
import type { RequestWithPlatformUser } from "./platform-auth.guard.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

/** Platform-side equivalent of `PermissionsGuard` — must run after `PlatformAuthGuard` has populated `request.platformUser`. */
@Injectable()
export class PlatformPermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PlatformPermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly metricsService: MetricsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<PlatformPermission | undefined>(
      REQUIRED_PLATFORM_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithPlatformUser>();
    const role = request.platformUser?.role;
    if (!role) {
      this.deny(request.platformUser?.platformUserId, requiredPermission);
    }

    const level = getPlatformPermissionLevel(role, requiredPermission);
    if (level === PermissionLevel.NONE) {
      this.deny(request.platformUser?.platformUserId, requiredPermission);
    }
    return true;
  }

  /** PHD-001 Volume-2 §4.11 — see `PermissionsGuard.deny()`'s identical doc comment for the full rationale. */
  private deny(platformUserId: string | undefined, permission: PlatformPermission): never {
    this.metricsService.securityPermissionDeniedTotal.inc({ actor: "platform" });
    this.logger.warn(
      `Platform permission denied${platformUserId ? ` for platform user ${platformUserId}` : ""} — required "${permission}"`,
    );
    throw new ForbiddenException("You do not have permission to perform this action");
  }
}
