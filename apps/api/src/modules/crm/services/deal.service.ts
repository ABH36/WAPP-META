import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Types } from "mongoose";
import {
  DealStage,
  getPermissionLevel,
  Permission,
  PermissionLevel,
  TERMINAL_DEAL_STAGES,
  TenantRole,
  WorkspaceMemberStatus,
} from "@wapp/shared-types";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  DealAssignedPayload,
  DealReopenedPayload,
  DealStageChangedPayload,
  DealUpdatedPayload,
} from "../../../common/events/domain-events.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { DealRepository, type DealSortField } from "../repositories/deal.repository.js";
import { DEAL_ELIGIBLE_ASSIGNEE_ROLES, DEAL_STAGE_TRANSITIONS } from "../crm.constants.js";
import { toDealSummary } from "../mappers/crm.mapper.js";
import type { DealSummary } from "../crm.types.js";
import type { UpdateDealDto } from "../dto/update-deal.dto.js";
import type { UpdateDealStageDto } from "../dto/update-deal-stage.dto.js";
import type { Paginated } from "../../../common/interceptors/response.interceptor.js";
import type { DealDocument } from "../schemas/deal.schema.js";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// §15 — WON/LOST get their own named milestone event; QUALIFICATION/PROPOSAL/
// NEGOTIATION fall back to the generic DEAL_STAGE_CHANGED — same dual-event
// shape as Lead's MILESTONE_STATUS_EVENTS (docs/ADR-CRM-012-deal-lifecycle-strategy.md).
const MILESTONE_STAGE_EVENTS: Partial<
  Record<DealStage, (typeof DomainEvent)[keyof typeof DomainEvent]>
> = {
  [DealStage.WON]: DomainEvent.DEAL_WON,
  [DealStage.LOST]: DomainEvent.DEAL_LOST,
};

export interface ListDealsOptions {
  stage?: DealStage;
  assignedTo?: string;
  customerId?: string;
  expectedCloseFrom?: string;
  expectedCloseTo?: string;
  q?: string;
  sortBy?: DealSortField;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * PRD-004 Volume-4 (Deal Management). Owns the pipeline/commercial lifecycle
 * after creation; Lead Conversion remains the only creation path (§3,
 * docs/ADR-CRM-010-deal-creation-boundary.md) — this service never creates a
 * Deal itself. Customer/Contact/sourceLeadId are permanent, immutable
 * identity (BR-003/§18) and are never touched by any method here.
 */
@Injectable()
export class DealService {
  constructor(
    private readonly dealRepository: DealRepository,
    private readonly userRepository: UserRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getById(workspaceId: string, id: string): Promise<DealSummary> {
    const deal = await this.findOrThrow(workspaceId, id);
    return toDealSummary(deal);
  }

  async list(workspaceId: string, options: ListDealsOptions): Promise<Paginated<DealSummary>> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit =
      options.limit && options.limit > 0
        ? Math.min(options.limit, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;
    const sortBy = options.sortBy ?? "createdAt";
    const sortOrder = options.sortOrder === "asc" ? 1 : -1;

    const { items, total } = await this.dealRepository.list(
      workspaceId,
      {
        stage: options.stage,
        assignedTo: options.assignedTo,
        customerId: options.customerId,
        expectedCloseFrom: options.expectedCloseFrom
          ? new Date(options.expectedCloseFrom)
          : undefined,
        expectedCloseTo: options.expectedCloseTo ? new Date(options.expectedCloseTo) : undefined,
        q: options.q,
      },
      sortBy,
      sortOrder,
      page,
      limit,
    );

    return {
      items: items.map(toDealSummary),
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

  /**
   * General field updates (title/description/value/currency/probability/
   * expectedCloseDate). No terminal-stage read-only restriction is imposed
   * here — unlike Lead's post-conversion immutability (an explicit BR-006
   * rule), Volume-4 states no equivalent rule for WON/LOST Deals, and
   * correcting a closed Deal's value/notes is ordinary CRM behaviour, not
   * a structural transformation the way Lead Conversion is. Flagged as a
   * reasoned default, not silently assumed — see
   * docs/ADR-CRM-012-deal-lifecycle-strategy.md.
   */
  async update(
    workspaceId: string,
    id: string,
    dto: UpdateDealDto,
    actorId: string,
  ): Promise<DealSummary> {
    await this.findOrThrow(workspaceId, id);

    const updated = await this.dealRepository.update(
      workspaceId,
      id,
      {
        ...dto,
        expectedCloseDate:
          dto.expectedCloseDate !== undefined ? new Date(dto.expectedCloseDate) : undefined,
      },
      actorId,
    );
    if (!updated) {
      throw new NotFoundException("Deal not found");
    }

    this.eventEmitter.emit(DomainEvent.DEAL_UPDATED, {
      workspaceId,
      dealId: id,
      updatedBy: actorId,
      occurredAt: new Date().toISOString(),
    } satisfies DealUpdatedPayload);

    return toDealSummary(updated);
  }

  /** §8/§9 — only SALES_EXECUTIVE-role members are eligible assignees (DEAL_ELIGIBLE_ASSIGNEE_ROLES). null unassigns. */
  async assign(
    workspaceId: string,
    id: string,
    assignedTo: string | null,
    actorId: string,
  ): Promise<DealSummary> {
    await this.findOrThrow(workspaceId, id);

    if (assignedTo) {
      // A malformed id would otherwise reach userRepository.findById's
      // Mongoose query and throw an uncaught CastError (surfaced as a 500
      // by the global exception filter) rather than a clean 400 — same
      // latent gap as LeadService.assign, flagged separately since Lead
      // Management is already frozen.
      if (!Types.ObjectId.isValid(assignedTo)) {
        throw new BadRequestException("Assignee must be an active member of this workspace");
      }
      const assignee = await this.userRepository.findById(assignedTo);
      if (
        !assignee ||
        assignee.workspaceId !== workspaceId ||
        assignee.workspaceMemberStatus !== WorkspaceMemberStatus.ACTIVE
      ) {
        throw new BadRequestException("Assignee must be an active member of this workspace");
      }
      if (!assignee.role || !DEAL_ELIGIBLE_ASSIGNEE_ROLES.includes(assignee.role as never)) {
        throw new BadRequestException("Assignee must be a Sales Executive");
      }
    }

    const updated = await this.dealRepository.updateAssignment(
      workspaceId,
      id,
      assignedTo,
      actorId,
    );
    if (!updated) {
      throw new NotFoundException("Deal not found");
    }

    this.eventEmitter.emit(assignedTo ? DomainEvent.DEAL_ASSIGNED : DomainEvent.DEAL_UNASSIGNED, {
      workspaceId,
      dealId: id,
      assignedTo,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies DealAssignedPayload);

    return toDealSummary(updated);
  }

  /**
   * §4/§7/BR-010 — enforces DEAL_STAGE_TRANSITIONS. Moving to a terminal
   * stage (WON/LOST) additionally requires CLOSE_DEALS (resolved
   * 2026-08-06: this single endpoint handles both non-terminal moves,
   * gated by CREATE_DEALS at the controller, and terminal moves, which
   * need the stricter CLOSE_DEALS the same way REPLY_CONVERSATIONS is
   * checked inline for conversation assignment eligibility) — see
   * docs/ADR-CRM-012-deal-lifecycle-strategy.md. BR-007 requires
   * lostReason exactly when the target is LOST.
   */
  async updateStage(
    workspaceId: string,
    id: string,
    dto: UpdateDealStageDto,
    actorId: string,
    actorRole: TenantRole | null,
  ): Promise<DealSummary> {
    const deal = await this.findOrThrow(workspaceId, id);

    const allowed = DEAL_STAGE_TRANSITIONS[deal.stage];
    if (!allowed.includes(dto.stage)) {
      throw new BadRequestException(`Cannot move a ${deal.stage} Deal to ${dto.stage}`);
    }

    if (
      TERMINAL_DEAL_STAGES.includes(dto.stage) &&
      (!actorRole || getPermissionLevel(actorRole, Permission.CLOSE_DEALS) === PermissionLevel.NONE)
    ) {
      throw new ForbiddenException("You do not have permission to close Deals");
    }

    if (dto.stage === DealStage.LOST && !dto.lostReason) {
      throw new BadRequestException("Lost Reason is required when marking a Deal Lost");
    }

    const now = new Date();
    const updated = await this.dealRepository.updateStage(workspaceId, id, dto.stage, actorId, {
      wonAt: dto.stage === DealStage.WON ? now : null,
      lostAt: dto.stage === DealStage.LOST ? now : null,
      lostReason: dto.stage === DealStage.LOST ? dto.lostReason! : null,
    });
    if (!updated) {
      throw new NotFoundException("Deal not found");
    }

    this.eventEmitter.emit(MILESTONE_STAGE_EVENTS[dto.stage] ?? DomainEvent.DEAL_STAGE_CHANGED, {
      workspaceId,
      dealId: id,
      previousStage: deal.stage,
      newStage: dto.stage,
      actorId,
      occurredAt: now.toISOString(),
    } satisfies DealStageChangedPayload);

    return toDealSummary(updated);
  }

  /** §7 — only a LOST Deal may be reopened; always resets to OPEN (resolved 2026-08-06). Permission (CLOSE_DEALS) enforced at the controller. */
  async reopen(workspaceId: string, id: string, actorId: string): Promise<DealSummary> {
    const deal = await this.findOrThrow(workspaceId, id);
    if (deal.stage !== DealStage.LOST) {
      throw new BadRequestException("Only a Lost Deal may be reopened");
    }

    const updated = await this.dealRepository.reopen(workspaceId, id, actorId);
    if (!updated) {
      throw new NotFoundException("Deal not found");
    }

    this.eventEmitter.emit(DomainEvent.DEAL_REOPENED, {
      workspaceId,
      dealId: id,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies DealReopenedPayload);

    return toDealSummary(updated);
  }

  private async findOrThrow(workspaceId: string, id: string): Promise<DealDocument> {
    const deal = await this.dealRepository.findByIdForWorkspace(workspaceId, id);
    if (!deal) {
      throw new NotFoundException("Deal not found");
    }
    return deal;
  }
}
