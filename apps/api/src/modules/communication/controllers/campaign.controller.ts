import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { CampaignService } from "../services/campaign.service.js";
import { CreateCampaignDto } from "../dto/create-campaign.dto.js";
import type {
  BroadcastSummary,
  CampaignStatsSummary,
  CampaignSummary,
} from "../communication.types.js";

// Reuses Broadcast's own permissions — PERMISSION_MATRIX (PRD-000C v1.1)
// was frozen without a dedicated Campaign row, and Campaign is a thin
// orchestration layer over Broadcast, not a separate capability domain.
@Controller({ path: "communication/campaigns", version: "1" })
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @RequirePermission(Permission.VIEW_BROADCASTS)
  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<CampaignSummary[]> {
    return this.campaignService.list(user.workspaceId!);
  }

  @RequirePermission(Permission.VIEW_BROADCASTS)
  @Get(":id")
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<CampaignSummary> {
    return this.campaignService.getById(user.workspaceId!, id);
  }

  @RequirePermission(Permission.VIEW_BROADCASTS)
  @Get(":id/waves")
  async listWaves(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<BroadcastSummary[]> {
    return this.campaignService.listWaves(user.workspaceId!, id);
  }

  @RequirePermission(Permission.VIEW_BROADCASTS)
  @Get(":id/stats")
  async getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<CampaignStatsSummary> {
    return this.campaignService.getStats(user.workspaceId!, id);
  }

  @RequirePermission(Permission.CREATE_BROADCAST)
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCampaignDto,
  ): Promise<CampaignSummary> {
    return this.campaignService.create(user.workspaceId!, user.userId, dto);
  }

  @RequirePermission(Permission.SEND_BROADCAST)
  @Patch(":id/cancel")
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<CampaignSummary> {
    return this.campaignService.cancel(user.workspaceId!, id, user.userId);
  }
}
