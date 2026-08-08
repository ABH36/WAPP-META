import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestWithPlatformUser } from "../guards/platform-auth.guard.js";
import type { AuthenticatedPlatformUser } from "../platform.types.js";

export const CurrentPlatformUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedPlatformUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithPlatformUser>();
    return request.platformUser as AuthenticatedPlatformUser;
  },
);
