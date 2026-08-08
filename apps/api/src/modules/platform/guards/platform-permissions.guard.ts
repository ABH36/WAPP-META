import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  PermissionLevel,
  getPlatformPermissionLevel,
  type PlatformPermission,
} from "@wapp/shared-types";
import { REQUIRED_PLATFORM_PERMISSION_KEY } from "../decorators/require-platform-permission.decorator.js";
import type { RequestWithPlatformUser } from "./platform-auth.guard.js";

/** Platform-side equivalent of `PermissionsGuard` — must run after `PlatformAuthGuard` has populated `request.platformUser`. */
@Injectable()
export class PlatformPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

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
      throw new ForbiddenException("You do not have permission to perform this action");
    }

    const level = getPlatformPermissionLevel(role, requiredPermission);
    if (level === PermissionLevel.NONE) {
      throw new ForbiddenException("You do not have permission to perform this action");
    }
    return true;
  }
}
