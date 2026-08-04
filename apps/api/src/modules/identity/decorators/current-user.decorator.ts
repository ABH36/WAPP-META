import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestWithUser } from "../guards/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../identity.types.js";

/** Reads the user JwtAuthGuard attached to the request. Only usable on non-@Public() routes. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user as AuthenticatedUser;
  },
);
