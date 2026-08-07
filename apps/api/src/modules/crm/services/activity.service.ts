import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Types } from "mongoose";
import {
  ActivityType,
  getPermissionLevel,
  Permission,
  PermissionLevel,
  TaskPriority,
  TaskStatus,
  TenantRole,
  WorkspaceMemberStatus,
} from "@wapp/shared-types";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  ActivityArchivedPayload,
  ActivityCreatedPayload,
  ActivityUpdatedPayload,
  FollowUpAssignedPayload,
  FollowUpCompletedPayload,
  TaskAssignedPayload,
  TaskCompletedPayload,
} from "../../../common/events/domain-events.js";
import { CustomerRepository } from "../repositories/customer.repository.js";
import { DealRepository } from "../repositories/deal.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { ActivityRepository, type ActivitySortField } from "../repositories/activity.repository.js";
import { toActivitySummary } from "../mappers/crm.mapper.js";
import type { ActivitySummary } from "../crm.types.js";
import type { CreateActivityDto } from "../dto/create-activity.dto.js";
import type { CreateNoteDto } from "../dto/create-note.dto.js";
import type { UpdateActivityDto } from "../dto/update-activity.dto.js";
import type { Paginated } from "../../../common/interceptors/response.interceptor.js";
import type { ActivityDocument } from "../schemas/activity.schema.js";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// §16 — NOTE_ADDED/FOLLOW_UP_SCHEDULED are the named milestones on
// creation; every other type falls back to the generic ACTIVITY_CREATED —
// same dual-event shape as Lead/Deal. See
// docs/ADR-CRM-015-activity-timeline-strategy.md.
const CREATION_MILESTONE_EVENTS: Partial<
  Record<ActivityType, (typeof DomainEvent)[keyof typeof DomainEvent]>
> = {
  [ActivityType.NOTE]: DomainEvent.NOTE_ADDED,
  [ActivityType.FOLLOW_UP]: DomainEvent.FOLLOW_UP_SCHEDULED,
};

export interface ListActivitiesOptions {
  type?: ActivityType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedUserId?: string;
  customerId?: string;
  dealId?: string;
  dueFrom?: string;
  dueTo?: string;
  q?: string;
  sortBy?: ActivitySortField;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * PRD-004 Volume-5 (Activities, Tasks, Follow-ups & Notes). A single
 * `activities` collection (docs/ADR-CRM-015-activity-timeline-strategy.md),
 * referencing Customer and/or Deal without owning either
 * (docs/ADR-CRM-016-activity-ownership-strategy.md).
 *
 * No dedicated Activities permission exists (resolved 2026-08-07,
 * Architecture Review): access is inherited from whichever record an
 * Activity references — VIEW_CUSTOMERS/EDIT_CUSTOMER for a Customer
 * reference, VIEW_DEALS/CREATE_DEALS for a Deal reference (CREATE_DEALS
 * already gates Deal's own general edits, Part-4). Because which
 * permission applies depends on the specific Activity's data, not a fixed
 * route, every method here checks inline (no `@RequirePermission` at the
 * controller) rather than at the decorator level — the same inline
 * technique already used for Deal's terminal-stage CLOSE_DEALS check,
 * applied to a genuinely per-instance case for the first time.
 */
@Injectable()
export class ActivityService {
  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly dealRepository: DealRepository,
    private readonly userRepository: UserRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    workspaceId: string,
    dto: CreateActivityDto,
    actorId: string,
    actorRole: TenantRole | null,
  ): Promise<ActivitySummary> {
    if (dto.type === ActivityType.NOTE) {
      throw new BadRequestException("Use POST /crm/notes to create a Note");
    }
    await this.validateReferences(workspaceId, dto.customerId ?? null, dto.dealId ?? null);
    this.ensureAccess(
      actorRole,
      dto.customerId ?? null,
      dto.dealId ?? null,
      Permission.EDIT_CUSTOMER,
      Permission.CREATE_DEALS,
    );
    if (dto.assignedUserId) {
      await this.validateAssignee(workspaceId, dto.assignedUserId);
    }

    const created = await this.activityRepository.create({
      workspaceId,
      type: dto.type,
      customerId: dto.customerId ?? null,
      dealId: dto.dealId ?? null,
      title: dto.title ?? null,
      description: dto.description ?? null,
      text: null,
      mentions: [],
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      priority: dto.priority ?? null,
      status: dto.type === ActivityType.TASK ? TaskStatus.PENDING : null,
      assignedUserId: dto.assignedUserId ?? null,
      followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
      followUpType: dto.followUpType ?? null,
      reminderDate: dto.reminderDate ? new Date(dto.reminderDate) : null,
      reminderType: dto.reminderType ?? null,
      createdBy: actorId,
    });

    this.emitCreated(created, actorId);
    return toActivitySummary(created);
  }

  /** §8/§17 — a specialized creation path for type=NOTE; the resulting document is a regular Activity. */
  async createNote(
    workspaceId: string,
    dto: CreateNoteDto,
    actorId: string,
    actorRole: TenantRole | null,
  ): Promise<ActivitySummary> {
    await this.validateReferences(workspaceId, dto.customerId ?? null, dto.dealId ?? null);
    this.ensureAccess(
      actorRole,
      dto.customerId ?? null,
      dto.dealId ?? null,
      Permission.EDIT_CUSTOMER,
      Permission.CREATE_DEALS,
    );

    const created = await this.activityRepository.create({
      workspaceId,
      type: ActivityType.NOTE,
      customerId: dto.customerId ?? null,
      dealId: dto.dealId ?? null,
      title: null,
      description: null,
      text: dto.text,
      mentions: dto.mentions ?? [],
      dueDate: null,
      priority: null,
      status: null,
      assignedUserId: null,
      followUpDate: null,
      followUpType: null,
      reminderDate: null,
      reminderType: null,
      createdBy: actorId,
    });

    this.emitCreated(created, actorId);
    return toActivitySummary(created);
  }

  async getById(
    workspaceId: string,
    id: string,
    actorRole: TenantRole | null,
  ): Promise<ActivitySummary> {
    const activity = await this.findOrThrow(workspaceId, id);
    this.ensureAccessForActivity(
      activity,
      actorRole,
      Permission.VIEW_CUSTOMERS,
      Permission.VIEW_DEALS,
    );
    return toActivitySummary(activity);
  }

  /**
   * §12/§13/§14 — list-level access is a broader gate than per-record
   * access (resolved implementation approach, not a separate business
   * decision): VIEW_CUSTOMERS/VIEW_DEALS in this codebase are workspace-wide
   * capabilities, not per-record ACLs (every Customer/Deal is visible to
   * anyone holding the permission — no existing list endpoint filters rows
   * by finer-grained access). An actor needs at least one of the two to see
   * anything meaningful; results aren't filtered per-row beyond that,
   * consistent with how Customer/Lead/Deal's own list endpoints behave.
   */
  async list(
    workspaceId: string,
    options: ListActivitiesOptions,
    actorRole: TenantRole | null,
  ): Promise<Paginated<ActivitySummary>> {
    if (
      !actorRole ||
      (getPermissionLevel(actorRole, Permission.VIEW_CUSTOMERS) === PermissionLevel.NONE &&
        getPermissionLevel(actorRole, Permission.VIEW_DEALS) === PermissionLevel.NONE)
    ) {
      throw new ForbiddenException("You do not have permission to view Activities");
    }

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit =
      options.limit && options.limit > 0
        ? Math.min(options.limit, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;
    const sortBy = options.sortBy ?? "createdAt";
    const sortOrder = options.sortOrder === "asc" ? 1 : -1;

    const { items, total } = await this.activityRepository.list(
      workspaceId,
      {
        type: options.type,
        status: options.status,
        priority: options.priority,
        assignedUserId: options.assignedUserId,
        customerId: options.customerId,
        dealId: options.dealId,
        dueFrom: options.dueFrom ? new Date(options.dueFrom) : undefined,
        dueTo: options.dueTo ? new Date(options.dueTo) : undefined,
        q: options.q,
      },
      sortBy,
      sortOrder,
      page,
      limit,
    );

    return {
      items: items.map(toActivitySummary),
      meta: {
        page,
        pageSize: limit,
        totalRecords: total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateActivityDto,
    actorId: string,
    actorRole: TenantRole | null,
  ): Promise<ActivitySummary> {
    const activity = await this.findOrThrow(workspaceId, id);
    this.ensureAccessForActivity(
      activity,
      actorRole,
      Permission.EDIT_CUSTOMER,
      Permission.CREATE_DEALS,
    );
    this.ensureNotReadOnly(activity);

    const updated = await this.activityRepository.update(
      workspaceId,
      id,
      {
        ...dto,
        dueDate: dto.dueDate !== undefined ? new Date(dto.dueDate) : undefined,
        followUpDate: dto.followUpDate !== undefined ? new Date(dto.followUpDate) : undefined,
        reminderDate: dto.reminderDate !== undefined ? new Date(dto.reminderDate) : undefined,
      },
      actorId,
    );
    if (!updated) {
      throw new NotFoundException("Activity not found");
    }

    this.eventEmitter.emit(DomainEvent.ACTIVITY_UPDATED, {
      workspaceId,
      activityId: id,
      updatedBy: actorId,
      occurredAt: new Date().toISOString(),
    } satisfies ActivityUpdatedPayload);

    return toActivitySummary(updated);
  }

  /** §11/BR-008 — Task assignment. Reused by assignFollowUp for the identical eligibility rule (ACTIVE Workspace member, no role restriction). */
  async assignTask(
    workspaceId: string,
    id: string,
    assignedUserId: string | null,
    actorId: string,
    actorRole: TenantRole | null,
  ): Promise<ActivitySummary> {
    const activity = await this.findOrThrowOfType(workspaceId, id, ActivityType.TASK);
    return this.assign(
      workspaceId,
      activity,
      assignedUserId,
      actorId,
      actorRole,
      DomainEvent.TASK_ASSIGNED,
      DomainEvent.TASK_UNASSIGNED,
    );
  }

  /**
   * §11/§17 — Follow-up assignment. Not listed in §17's API table, but §11
   * explicitly states Follow-ups are assignable the same as Tasks; added
   * for consistency with Task's own dedicated endpoint (resolved
   * 2026-08-07 architecture review's "add the missing endpoint" principle,
   * applied here the same way it was applied to the archive endpoint).
   */
  async assignFollowUp(
    workspaceId: string,
    id: string,
    assignedUserId: string | null,
    actorId: string,
    actorRole: TenantRole | null,
  ): Promise<ActivitySummary> {
    const activity = await this.findOrThrowOfType(workspaceId, id, ActivityType.FOLLOW_UP);
    return this.assign(
      workspaceId,
      activity,
      assignedUserId,
      actorId,
      actorRole,
      DomainEvent.FOLLOW_UP_ASSIGNED,
      DomainEvent.FOLLOW_UP_UNASSIGNED,
    );
  }

  /** BR-004 — Task only. Completed Tasks become read-only (enforced via ensureNotReadOnly on every other mutation). */
  async updateTaskStatus(
    workspaceId: string,
    id: string,
    status: TaskStatus,
    actorId: string,
    actorRole: TenantRole | null,
  ): Promise<ActivitySummary> {
    const activity = await this.findOrThrowOfType(workspaceId, id, ActivityType.TASK);
    this.ensureAccessForActivity(
      activity,
      actorRole,
      Permission.EDIT_CUSTOMER,
      Permission.CREATE_DEALS,
    );
    this.ensureNotReadOnly(activity);

    const updated = await this.activityRepository.updateTaskStatus(
      workspaceId,
      id,
      status,
      actorId,
    );
    if (!updated) {
      throw new NotFoundException("Activity not found");
    }

    this.eventEmitter.emit(
      status === TaskStatus.COMPLETED ? DomainEvent.TASK_COMPLETED : DomainEvent.ACTIVITY_UPDATED,
      status === TaskStatus.COMPLETED
        ? ({
            workspaceId,
            activityId: id,
            actorId,
            occurredAt: new Date().toISOString(),
          } satisfies TaskCompletedPayload)
        : ({
            workspaceId,
            activityId: id,
            updatedBy: actorId,
            occurredAt: new Date().toISOString(),
          } satisfies ActivityUpdatedPayload),
    );

    return toActivitySummary(updated);
  }

  /** BR-005 — Follow-up only. Idempotency guard: an already-completed Follow-up can't be completed again (mirrors ensureNotReadOnly's intent for the one Follow-up mutation that doesn't go through it). */
  async completeFollowUp(
    workspaceId: string,
    id: string,
    actorId: string,
    actorRole: TenantRole | null,
  ): Promise<ActivitySummary> {
    const activity = await this.findOrThrowOfType(workspaceId, id, ActivityType.FOLLOW_UP);
    this.ensureAccessForActivity(
      activity,
      actorRole,
      Permission.EDIT_CUSTOMER,
      Permission.CREATE_DEALS,
    );
    if (activity.followUpCompletedAt) {
      throw new BadRequestException("This Follow-up is already completed");
    }

    const updated = await this.activityRepository.completeFollowUp(workspaceId, id, actorId);
    if (!updated) {
      throw new NotFoundException("Activity not found");
    }

    this.eventEmitter.emit(DomainEvent.FOLLOW_UP_COMPLETED, {
      workspaceId,
      activityId: id,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies FollowUpCompletedPayload);

    return toActivitySummary(updated);
  }

  /** BR-006 — soft delete only. */
  async archive(
    workspaceId: string,
    id: string,
    actorId: string,
    actorRole: TenantRole | null,
  ): Promise<ActivitySummary> {
    const activity = await this.findOrThrow(workspaceId, id);
    this.ensureAccessForActivity(
      activity,
      actorRole,
      Permission.EDIT_CUSTOMER,
      Permission.CREATE_DEALS,
    );
    if (activity.archivedAt) {
      throw new BadRequestException("Activity is already archived");
    }

    const updated = await this.activityRepository.archive(workspaceId, id, actorId);
    if (!updated) {
      throw new NotFoundException("Activity not found");
    }

    this.eventEmitter.emit(DomainEvent.ACTIVITY_ARCHIVED, {
      workspaceId,
      activityId: id,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies ActivityArchivedPayload);

    return toActivitySummary(updated);
  }

  private async assign(
    workspaceId: string,
    activity: ActivityDocument,
    assignedUserId: string | null,
    actorId: string,
    actorRole: TenantRole | null,
    assignedEvent: (typeof DomainEvent)[keyof typeof DomainEvent],
    unassignedEvent: (typeof DomainEvent)[keyof typeof DomainEvent],
  ): Promise<ActivitySummary> {
    this.ensureAccessForActivity(
      activity,
      actorRole,
      Permission.EDIT_CUSTOMER,
      Permission.CREATE_DEALS,
    );
    this.ensureNotReadOnly(activity);

    if (assignedUserId) {
      await this.validateAssignee(workspaceId, assignedUserId);
    }

    const updated = await this.activityRepository.updateAssignment(
      workspaceId,
      activity._id.toString(),
      assignedUserId,
      actorId,
    );
    if (!updated) {
      throw new NotFoundException("Activity not found");
    }

    this.eventEmitter.emit(assignedUserId ? assignedEvent : unassignedEvent, {
      workspaceId,
      activityId: activity._id.toString(),
      assignedUserId,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies TaskAssignedPayload | FollowUpAssignedPayload);

    return toActivitySummary(updated);
  }

  /** §5/BR-003 — at least one reference required; each, if supplied, must resolve to a real record in this Workspace. */
  private async validateReferences(
    workspaceId: string,
    customerId: string | null,
    dealId: string | null,
  ): Promise<void> {
    if (!customerId && !dealId) {
      throw new BadRequestException("An Activity must reference a Customer or a Deal");
    }
    if (customerId) {
      const customer = await this.customerRepository.findByIdForWorkspace(workspaceId, customerId);
      if (!customer) {
        throw new BadRequestException("Invalid Customer");
      }
    }
    if (dealId) {
      const deal = await this.dealRepository.findByIdForWorkspace(workspaceId, dealId);
      if (!deal) {
        throw new BadRequestException("Invalid Deal");
      }
    }
  }

  /** BR-008 — ACTIVE Workspace member, no role restriction (deliberately broader than Lead/Deal's Sales-Executive-only model). */
  private async validateAssignee(workspaceId: string, assignedUserId: string): Promise<void> {
    if (!Types.ObjectId.isValid(assignedUserId)) {
      throw new BadRequestException("Assignee must be an active member of this workspace");
    }
    const assignee = await this.userRepository.findById(assignedUserId);
    if (
      !assignee ||
      assignee.workspaceId !== workspaceId ||
      assignee.workspaceMemberStatus !== WorkspaceMemberStatus.ACTIVE
    ) {
      throw new BadRequestException("Assignee must be an active member of this workspace");
    }
  }

  private ensureAccess(
    actorRole: TenantRole | null,
    customerId: string | null,
    dealId: string | null,
    customerPermission: Permission,
    dealPermission: Permission,
  ): void {
    if (!actorRole) {
      throw new ForbiddenException("You do not have permission to perform this action");
    }
    if (customerId && getPermissionLevel(actorRole, customerPermission) === PermissionLevel.NONE) {
      throw new ForbiddenException(
        "You do not have permission to access this Customer's Activities",
      );
    }
    if (dealId && getPermissionLevel(actorRole, dealPermission) === PermissionLevel.NONE) {
      throw new ForbiddenException("You do not have permission to access this Deal's Activities");
    }
  }

  private ensureAccessForActivity(
    activity: ActivityDocument,
    actorRole: TenantRole | null,
    customerPermission: Permission,
    dealPermission: Permission,
  ): void {
    this.ensureAccess(
      actorRole,
      activity.customerId ? activity.customerId.toString() : null,
      activity.dealId ? activity.dealId.toString() : null,
      customerPermission,
      dealPermission,
    );
  }

  /** BR-004/BR-005 — a completed Task or completed Follow-up is read-only for every mutation except archive. */
  private ensureNotReadOnly(activity: ActivityDocument): void {
    if (activity.type === ActivityType.TASK && activity.status === TaskStatus.COMPLETED) {
      throw new BadRequestException("A completed Task is read-only");
    }
    if (activity.type === ActivityType.FOLLOW_UP && activity.followUpCompletedAt) {
      throw new BadRequestException("A completed Follow-up is read-only");
    }
  }

  private emitCreated(activity: ActivityDocument, actorId: string): void {
    this.eventEmitter.emit(
      CREATION_MILESTONE_EVENTS[activity.type] ?? DomainEvent.ACTIVITY_CREATED,
      {
        workspaceId: activity.workspaceId,
        activityId: activity._id.toString(),
        type: activity.type,
        customerId: activity.customerId ? activity.customerId.toString() : null,
        dealId: activity.dealId ? activity.dealId.toString() : null,
        createdBy: actorId,
        occurredAt: new Date().toISOString(),
      } satisfies ActivityCreatedPayload,
    );
  }

  private async findOrThrow(workspaceId: string, id: string): Promise<ActivityDocument> {
    const activity = await this.activityRepository.findByIdForWorkspace(workspaceId, id);
    if (!activity) {
      throw new NotFoundException("Activity not found");
    }
    return activity;
  }

  private async findOrThrowOfType(
    workspaceId: string,
    id: string,
    type: ActivityType,
  ): Promise<ActivityDocument> {
    const activity = await this.findOrThrow(workspaceId, id);
    if (activity.type !== type) {
      throw new NotFoundException(`Activity not found`);
    }
    return activity;
  }
}
