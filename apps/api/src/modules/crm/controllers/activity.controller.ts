import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ActivityType, TaskPriority, TaskStatus } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { ActivityService } from "../services/activity.service.js";
import { CreateActivityDto } from "../dto/create-activity.dto.js";
import { CreateNoteDto } from "../dto/create-note.dto.js";
import { UpdateActivityDto } from "../dto/update-activity.dto.js";
import { AssignActivityDto } from "../dto/assign-activity.dto.js";
import { UpdateTaskStatusDto } from "../dto/update-task-status.dto.js";
import type { ActivitySortField } from "../repositories/activity.repository.js";
import type { ActivitySummary } from "../crm.types.js";
import type { Paginated } from "../../../common/interceptors/response.interceptor.js";

const SORT_FIELDS = new Set<ActivitySortField>(["createdAt", "updatedAt", "dueDate", "priority"]);

/**
 * No `@RequirePermission` decorators anywhere in this controller —
 * deliberate, not an oversight. Activities have no permission of their own
 * (resolved 2026-08-07, Architecture Review): access is inherited from
 * whichever Customer/Deal a specific Activity references, which isn't
 * knowable until the document is loaded — so every check happens inline in
 * ActivityService, not at the route-decorator level. See
 * docs/ADR-CRM-016-activity-ownership-strategy.md.
 *
 * One controller spans /crm/activities, /crm/tasks/:id/*,
 * /crm/follow-ups/:id/*, and /crm/notes — all one resource concept
 * (Activity), same as LeadController already mixing /crm/leads/* with the
 * conceptually distinct /convert action.
 */
@Controller({ path: "crm", version: "1" })
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post("activities")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateActivityDto,
  ): Promise<ActivitySummary> {
    return this.activityService.create(user.workspaceId!, dto, user.userId, user.role);
  }

  @Get("activities")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("type") type?: ActivityType,
    @Query("status") status?: TaskStatus,
    @Query("priority") priority?: TaskPriority,
    @Query("assignedUserId") assignedUserId?: string,
    @Query("customerId") customerId?: string,
    @Query("dealId") dealId?: string,
    @Query("dueFrom") dueFrom?: string,
    @Query("dueTo") dueTo?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: "asc" | "desc",
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<Paginated<ActivitySummary>> {
    return this.activityService.list(
      user.workspaceId!,
      {
        type,
        status,
        priority,
        assignedUserId,
        customerId,
        dealId,
        dueFrom,
        dueTo,
        sortBy:
          sortBy && SORT_FIELDS.has(sortBy as ActivitySortField)
            ? (sortBy as ActivitySortField)
            : undefined,
        sortOrder,
        page: page ? Number.parseInt(page, 10) : undefined,
        limit: limit ? Number.parseInt(limit, 10) : undefined,
      },
      user.role,
    );
  }

  // §12 — free-text search across Title/Description/Note text. Registered
  // before ":id" so Nest doesn't match "search" as an id param.
  @Get("activities/search")
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query("q") q: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<Paginated<ActivitySummary>> {
    return this.activityService.list(
      user.workspaceId!,
      {
        q,
        page: page ? Number.parseInt(page, 10) : undefined,
        limit: limit ? Number.parseInt(limit, 10) : undefined,
      },
      user.role,
    );
  }

  @Get("activities/:id")
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<ActivitySummary> {
    return this.activityService.getById(user.workspaceId!, id, user.role);
  }

  @Patch("activities/:id")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateActivityDto,
  ): Promise<ActivitySummary> {
    return this.activityService.update(user.workspaceId!, id, dto, user.userId, user.role);
  }

  // §17 resolved 2026-08-07 — missing from the original API list; BR-006
  // requires soft-delete capability, so the endpoint was added.
  @Patch("activities/:id/archive")
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<ActivitySummary> {
    return this.activityService.archive(user.workspaceId!, id, user.userId, user.role);
  }

  @Patch("tasks/:id/assign")
  async assignTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: AssignActivityDto,
  ): Promise<ActivitySummary> {
    return this.activityService.assignTask(
      user.workspaceId!,
      id,
      dto.assignedUserId ?? null,
      user.userId,
      user.role,
    );
  }

  @Patch("tasks/:id/status")
  async updateTaskStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateTaskStatusDto,
  ): Promise<ActivitySummary> {
    return this.activityService.updateTaskStatus(
      user.workspaceId!,
      id,
      dto.status,
      user.userId,
      user.role,
    );
  }

  // §11 resolved 2026-08-07 — missing from the original API list; §11
  // states Follow-ups are assignable the same as Tasks, so the endpoint
  // was added for consistency with /tasks/:id/assign.
  @Patch("follow-ups/:id/assign")
  async assignFollowUp(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: AssignActivityDto,
  ): Promise<ActivitySummary> {
    return this.activityService.assignFollowUp(
      user.workspaceId!,
      id,
      dto.assignedUserId ?? null,
      user.userId,
      user.role,
    );
  }

  @Patch("follow-ups/:id/complete")
  async completeFollowUp(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<ActivitySummary> {
    return this.activityService.completeFollowUp(user.workspaceId!, id, user.userId, user.role);
  }

  @Post("notes")
  async createNote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNoteDto,
  ): Promise<ActivitySummary> {
    return this.activityService.createNote(user.workspaceId!, dto, user.userId, user.role);
  }
}
