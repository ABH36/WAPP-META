import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { BroadcastService } from "../services/broadcast.service.js";
import type { BroadcastRecipientStats } from "../repositories/broadcast-recipient.repository.js";
import { CreateBroadcastDto } from "../dto/create-broadcast.dto.js";
import type { BroadcastRecipientSummary, BroadcastSummary } from "../communication.types.js";
import type { Paginated } from "../../../common/interceptors/response.interceptor.js";

const DEFAULT_PAGE_SIZE = 25;

@Controller({ path: "communication/broadcasts", version: "1" })
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @RequirePermission(Permission.VIEW_BROADCASTS)
  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<BroadcastSummary[]> {
    return this.broadcastService.list(user.workspaceId!);
  }

  @RequirePermission(Permission.VIEW_BROADCASTS)
  @Get(":id")
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<BroadcastSummary> {
    return this.broadcastService.getById(user.workspaceId!, id);
  }

  @RequirePermission(Permission.VIEW_BROADCASTS)
  @Get(":id/stats")
  async getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<BroadcastRecipientStats> {
    return this.broadcastService.getStats(user.workspaceId!, id);
  }

  @RequirePermission(Permission.VIEW_BROADCASTS)
  @Get(":id/recipients")
  async listRecipients(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<Paginated<BroadcastRecipientSummary>> {
    const parsedPage = page ? Number.parseInt(page, 10) : 1;
    const parsedLimit = limit ? Number.parseInt(limit, 10) : DEFAULT_PAGE_SIZE;
    return this.broadcastService.listRecipients(
      user.workspaceId!,
      id,
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE,
    );
  }

  @RequirePermission(Permission.CREATE_BROADCAST)
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBroadcastDto,
  ): Promise<BroadcastSummary> {
    return this.broadcastService.create(user.workspaceId!, user.userId, dto);
  }

  @RequirePermission(Permission.SEND_BROADCAST)
  @Post(":id/send")
  async send(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<BroadcastSummary> {
    return this.broadcastService.send(user.workspaceId!, id, user.userId);
  }

  @RequirePermission(Permission.SEND_BROADCAST)
  @Patch(":id/pause")
  async pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<BroadcastSummary> {
    return this.broadcastService.pause(user.workspaceId!, id);
  }

  @RequirePermission(Permission.SEND_BROADCAST)
  @Patch(":id/resume")
  async resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<BroadcastSummary> {
    return this.broadcastService.resume(user.workspaceId!, id);
  }

  @RequirePermission(Permission.SEND_BROADCAST)
  @Patch(":id/cancel")
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<BroadcastSummary> {
    return this.broadcastService.cancel(user.workspaceId!, id);
  }
}
