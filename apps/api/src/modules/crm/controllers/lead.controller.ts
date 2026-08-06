import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { LeadSource, LeadStatus, Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { LeadService } from "../services/lead.service.js";
import { CreateLeadDto } from "../dto/create-lead.dto.js";
import { UpdateLeadDto } from "../dto/update-lead.dto.js";
import { AssignLeadDto } from "../dto/assign-lead.dto.js";
import { UpdateLeadStatusDto } from "../dto/update-lead-status.dto.js";
import type { LeadSortField } from "../repositories/lead.repository.js";
import type { LeadSummary } from "../crm.types.js";
import type { Paginated } from "../../../common/interceptors/response.interceptor.js";

const SORT_FIELDS = new Set<LeadSortField>(["leadName", "createdAt", "updatedAt", "expectedValue"]);

/**
 * Every mutation endpoint below is gated by UPDATE_LEAD_STAGE, reused
 * broadly (resolved 2026-08-06, Architecture Review — PRD-000C has no
 * dedicated ASSIGN_LEADS/EDIT_LEAD permission, and the instruction was to
 * reuse the existing model rather than expand RBAC without an explicit
 * PRD-000C requirement). CREATE_LEADS/VIEW_LEADS keep their own literal
 * meaning.
 */
@Controller({ path: "crm/leads", version: "1" })
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @RequirePermission(Permission.CREATE_LEADS)
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeadDto,
  ): Promise<LeadSummary> {
    return this.leadService.create(user.workspaceId!, dto, user.userId);
  }

  @RequirePermission(Permission.VIEW_LEADS)
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: LeadStatus,
    @Query("source") source?: LeadSource,
    @Query("assignedUserId") assignedUserId?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: "asc" | "desc",
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<Paginated<LeadSummary>> {
    return this.leadService.list(user.workspaceId!, {
      status,
      source,
      assignedUserId,
      sortBy:
        sortBy && SORT_FIELDS.has(sortBy as LeadSortField) ? (sortBy as LeadSortField) : undefined,
      sortOrder,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  // §13/§19 — free-text search across Name/Mobile/Company/Email.
  // Registered before ":id" so Nest doesn't match "search" as an id param.
  @RequirePermission(Permission.VIEW_LEADS)
  @Get("search")
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query("q") q: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<Paginated<LeadSummary>> {
    return this.leadService.list(user.workspaceId!, {
      q,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @RequirePermission(Permission.VIEW_LEADS)
  @Get(":id")
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<LeadSummary> {
    return this.leadService.getById(user.workspaceId!, id);
  }

  @RequirePermission(Permission.UPDATE_LEAD_STAGE)
  @Patch(":id")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateLeadDto,
  ): Promise<LeadSummary> {
    return this.leadService.update(user.workspaceId!, id, dto, user.userId);
  }

  @RequirePermission(Permission.UPDATE_LEAD_STAGE)
  @Patch(":id/assign")
  async assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: AssignLeadDto,
  ): Promise<LeadSummary> {
    return this.leadService.assign(user.workspaceId!, id, dto.assignedUserId ?? null, user.userId);
  }

  @RequirePermission(Permission.UPDATE_LEAD_STAGE)
  @Patch(":id/status")
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateLeadStatusDto,
  ): Promise<LeadSummary> {
    return this.leadService.updateStatus(user.workspaceId!, id, dto.status, user.userId);
  }

  @RequirePermission(Permission.UPDATE_LEAD_STAGE)
  @Patch(":id/archive")
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<LeadSummary> {
    return this.leadService.archive(user.workspaceId!, id, user.userId);
  }
}
