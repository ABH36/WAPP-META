import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { PlatformSupportSessionsService } from "../services/platform-support-sessions.service.js";
import type { RequestWithPlatformUser } from "./platform-auth.guard.js";

/**
 * PRD-007 Volume-3 §4.7/§11 — the authorization boundary for every
 * cross-tenant read this volume adds (Workspace Overview, Investigation
 * Timeline). Must run after `PlatformAuthGuard` has populated
 * `request.platformUser`. Reads the target workspace id from either the
 * route param (`:id` on `GET /platform/support/workspaces/:id`) or the
 * query string (`?workspaceId=` on `GET /platform/investigation`) — the two
 * gated routes use different shapes per §9's own literal API surface.
 */
@Injectable()
export class SupportSessionGuard implements CanActivate {
  constructor(private readonly platformSupportSessionsService: PlatformSupportSessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPlatformUser>();
    const workspaceId = (request.params.id ?? request.query.workspaceId) as string | undefined;
    if (!workspaceId) {
      throw new ForbiddenException("A workspace id is required");
    }

    const platformUserId = request.platformUser?.platformUserId;
    if (!platformUserId) {
      throw new ForbiddenException("Platform authentication required");
    }

    await this.platformSupportSessionsService.ensureActiveAccess(workspaceId, platformUserId);
    return true;
  }
}
