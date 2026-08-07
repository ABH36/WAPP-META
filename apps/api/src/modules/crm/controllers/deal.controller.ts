import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { DealStage, Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { DealService } from "../services/deal.service.js";
import { UpdateDealDto } from "../dto/update-deal.dto.js";
import { AssignDealDto } from "../dto/assign-deal.dto.js";
import { UpdateDealStageDto } from "../dto/update-deal-stage.dto.js";
import type { DealSortField } from "../repositories/deal.repository.js";
import type { DealSummary } from "../crm.types.js";
import type { Paginated } from "../../../common/interceptors/response.interceptor.js";

const SORT_FIELDS = new Set<DealSortField>([
  "createdAt",
  "updatedAt",
  "value",
  "probability",
  "expectedCloseDate",
  "title",
]);

/**
 * No POST / (Deal creation) and no DELETE /:id — resolved 2026-08-06,
 * Architecture Review: Lead Conversion remains the only creation path
 * (docs/ADR-CRM-010-deal-creation-boundary.md), and a Deal is permanent
 * once created (§18/BR-008 audit-preservation, no archive mechanism
 * defined for Deal). CREATE_DEALS gates general updates and assignment;
 * CLOSE_DEALS gates the terminal WON/LOST stage transition (checked inline
 * in DealService.updateStage, since /:id/stage handles both non-terminal
 * and terminal moves) and reopen — see
 * docs/ADR-CRM-012-deal-lifecycle-strategy.md.
 */
@Controller({ path: "crm/deals", version: "1" })
export class DealController {
  constructor(private readonly dealService: DealService) {}

  @RequirePermission(Permission.VIEW_DEALS)
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("stage") stage?: DealStage,
    @Query("assignedTo") assignedTo?: string,
    @Query("customerId") customerId?: string,
    @Query("expectedCloseFrom") expectedCloseFrom?: string,
    @Query("expectedCloseTo") expectedCloseTo?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: "asc" | "desc",
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<Paginated<DealSummary>> {
    return this.dealService.list(user.workspaceId!, {
      stage,
      assignedTo,
      customerId,
      expectedCloseFrom,
      expectedCloseTo,
      sortBy:
        sortBy && SORT_FIELDS.has(sortBy as DealSortField) ? (sortBy as DealSortField) : undefined,
      sortOrder,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  // §12 — free-text search by Title. Registered before ":id" so Nest
  // doesn't match "search" as an id param.
  @RequirePermission(Permission.VIEW_DEALS)
  @Get("search")
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query("q") q: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<Paginated<DealSummary>> {
    return this.dealService.list(user.workspaceId!, {
      q,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @RequirePermission(Permission.VIEW_DEALS)
  @Get(":id")
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<DealSummary> {
    return this.dealService.getById(user.workspaceId!, id);
  }

  @RequirePermission(Permission.CREATE_DEALS)
  @Patch(":id")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateDealDto,
  ): Promise<DealSummary> {
    return this.dealService.update(user.workspaceId!, id, dto, user.userId);
  }

  @RequirePermission(Permission.CREATE_DEALS)
  @Patch(":id/assign")
  async assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: AssignDealDto,
  ): Promise<DealSummary> {
    return this.dealService.assign(user.workspaceId!, id, dto.assignedTo ?? null, user.userId);
  }

  @RequirePermission(Permission.CREATE_DEALS)
  @Patch(":id/stage")
  async updateStage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateDealStageDto,
  ): Promise<DealSummary> {
    return this.dealService.updateStage(user.workspaceId!, id, dto, user.userId, user.role);
  }

  @RequirePermission(Permission.CLOSE_DEALS)
  @Post(":id/reopen")
  async reopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<DealSummary> {
    return this.dealService.reopen(user.workspaceId!, id, user.userId);
  }
}
