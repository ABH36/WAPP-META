import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { getPermissionLevel, Permission, PermissionLevel } from "@wapp/shared-types";
import { REQUIRED_PERMISSION_KEY } from "../decorators/require-permission.decorator.js";
import type { RequestWithUser } from "./jwt-auth.guard.js";

/**
 * Applied after JwtAuthGuard (which must run first — this guard trusts
 * `request.user` is already populated). Fails closed: a user with no role
 * yet (no Workspace — see User schema doc comment) can never satisfy a
 * `@RequirePermission()` check, which is the correct default until the
 * Workspace module assigns one.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

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
      throw new ForbiddenException("You do not have permission to perform this action");
    }

    const level = getPermissionLevel(role, requiredPermission);
    if (level === PermissionLevel.NONE) {
      throw new ForbiddenException("You do not have permission to perform this action");
    }

    return true;
  }
}
