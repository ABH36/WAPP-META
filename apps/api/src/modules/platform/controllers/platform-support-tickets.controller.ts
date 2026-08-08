import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import { PlatformSupportTicketsService } from "../services/platform-support-tickets.service.js";
import { CreateSupportTicketDto } from "../dto/create-support-ticket.dto.js";
import { UpdateSupportTicketDto } from "../dto/update-support-ticket.dto.js";
import { ListSupportTicketsQueryDto } from "../dto/list-support-tickets-query.dto.js";
import type { AuthenticatedPlatformUser, SupportTicketSummary } from "../platform.types.js";

/** §4.6/§9 — GET/POST /platform/support/tickets, PATCH /platform/support/tickets/:id. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/support/tickets", version: "1" })
export class PlatformSupportTicketsController {
  constructor(private readonly platformSupportTicketsService: PlatformSupportTicketsService) {}

  @RequirePlatformPermission(PlatformPermission.MANAGE_SUPPORT)
  @Get()
  async list(@Query() query: ListSupportTicketsQueryDto): Promise<SupportTicketSummary[]> {
    return this.platformSupportTicketsService.list(query);
  }

  @RequirePlatformPermission(PlatformPermission.MANAGE_SUPPORT)
  @Post()
  async create(
    @Body() dto: CreateSupportTicketDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<SupportTicketSummary> {
    return this.platformSupportTicketsService.create(
      dto.workspaceId,
      dto.title,
      dto.category,
      dto.priority,
      user.platformUserId,
    );
  }

  @RequirePlatformPermission(PlatformPermission.MANAGE_SUPPORT)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateSupportTicketDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<SupportTicketSummary> {
    return this.platformSupportTicketsService.update(id, dto, user.platformUserId);
  }
}
