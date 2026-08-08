import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { PlatformPermission, WorkspaceStatus } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import { PlatformWorkspaceRegistryService } from "../services/platform-workspace-registry.service.js";
import { ListWorkspacesQueryDto } from "../dto/list-workspaces-query.dto.js";
import { UpdateWorkspaceStatusDto } from "../dto/update-workspace-status.dto.js";
import type { AuthenticatedPlatformUser, PlatformWorkspaceSummary } from "../platform.types.js";
import type { ListWorkspacesForPlatformResult } from "../services/platform-workspace-registry.service.js";

/** §4.1/§9 — GET /platform/workspaces, PATCH /platform/workspaces/:id/status. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/workspaces", version: "1" })
export class PlatformWorkspacesController {
  constructor(
    private readonly platformWorkspaceRegistryService: PlatformWorkspaceRegistryService,
  ) {}

  @RequirePlatformPermission(PlatformPermission.VIEW_WORKSPACES)
  @Get()
  async list(@Query() query: ListWorkspacesQueryDto): Promise<ListWorkspacesForPlatformResult> {
    return this.platformWorkspaceRegistryService.list(
      { status: query.status, q: query.q },
      query.page,
      query.limit,
    );
  }

  @RequirePlatformPermission(PlatformPermission.MANAGE_WORKSPACE_STATUS)
  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateWorkspaceStatusDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<PlatformWorkspaceSummary> {
    switch (dto.status) {
      case WorkspaceStatus.SUSPENDED:
        return this.platformWorkspaceRegistryService.suspend(
          id,
          dto.reason as string,
          user.platformUserId,
        );
      case WorkspaceStatus.ARCHIVED:
        return this.platformWorkspaceRegistryService.archive(
          id,
          dto.reason as string,
          user.platformUserId,
        );
      case WorkspaceStatus.ACTIVE:
      default:
        return this.platformWorkspaceRegistryService.reactivate(id, user.platformUserId);
    }
  }
}
