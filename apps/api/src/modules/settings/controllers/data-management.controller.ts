import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { DataExportService } from "../services/data-export.service.js";
import { RetentionPolicyService } from "../services/retention-policy.service.js";
import { CreateExportJobDto } from "../dto/create-export-job.dto.js";
import { UpdateRetentionPolicyDto } from "../dto/update-retention-policy.dto.js";
import type { ExportJobSummary, RetentionPolicySummary } from "../settings.types.js";

/** PRD-006 Volume-4 §4.3/§4.4. Reuses EDIT_WORKSPACE throughout. */
@Controller({ path: "settings", version: "1" })
export class DataManagementController {
  constructor(
    private readonly dataExportService: DataExportService,
    private readonly retentionPolicyService: RetentionPolicyService,
  ) {}

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Post("export")
  async createExport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExportJobDto,
  ): Promise<ExportJobSummary> {
    return this.dataExportService.create(user.workspaceId!, user.userId, dto);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Get("export/:id")
  async getExportStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<ExportJobSummary> {
    return this.dataExportService.getStatus(user.workspaceId!, id);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Get("retention")
  async getRetentionPolicy(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RetentionPolicySummary> {
    return this.retentionPolicyService.getPolicy(user.workspaceId!);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch("retention")
  async updateRetentionPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRetentionPolicyDto,
  ): Promise<RetentionPolicySummary> {
    return this.retentionPolicyService.updatePolicy(user.workspaceId!, user.userId, dto);
  }
}
