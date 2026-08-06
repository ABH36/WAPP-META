import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { LeadSource, LeadStatus, WorkspaceMemberStatus } from "@wapp/shared-types";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  LeadArchivedPayload,
  LeadAssignedPayload,
  LeadCreatedPayload,
  LeadStatusChangedPayload,
  LeadUpdatedPayload,
} from "../../../common/events/domain-events.js";
import { ContactRepository } from "../../communication/repositories/contact.repository.js";
import { CustomerRepository } from "../repositories/customer.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { LeadRepository, type LeadSortField } from "../repositories/lead.repository.js";
import { LEAD_ELIGIBLE_ASSIGNEE_ROLES, LEAD_STATUS_TRANSITIONS } from "../crm.constants.js";
import { toLeadSummary } from "../mappers/crm.mapper.js";
import type { LeadSummary } from "../crm.types.js";
import type { CreateLeadDto } from "../dto/create-lead.dto.js";
import type { UpdateLeadDto } from "../dto/update-lead.dto.js";
import type { Paginated } from "../../../common/interceptors/response.interceptor.js";
import type { LeadDocument } from "../schemas/lead.schema.js";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// §17 — only these three status targets get their own named event; every
// other transition falls back to the generic LEAD_STATUS_CHANGED (BR-010
// mandates an event on every status change) — see
// docs/ADR-CRM-005-lead-qualification-strategy.md.
const MILESTONE_STATUS_EVENTS: Partial<
  Record<LeadStatus, (typeof DomainEvent)[keyof typeof DomainEvent]>
> = {
  [LeadStatus.QUALIFIED]: DomainEvent.LEAD_QUALIFIED,
  [LeadStatus.WON]: DomainEvent.LEAD_WON,
  [LeadStatus.LOST]: DomainEvent.LEAD_LOST,
};

export interface ListLeadsOptions {
  status?: LeadStatus;
  source?: LeadSource;
  assignedUserId?: string;
  q?: string;
  sortBy?: LeadSortField;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * PRD-004 Volume-2 (Lead Management). Owns sales qualification; Contact
 * stays Communication-owned, Customer stays Customer-Management-owned (§3)
 * — see docs/ADR-CRM-006-lead-ownership-strategy.md. Resolves/creates a
 * Contact through the exported ContactRepository (same pattern
 * CustomerService already uses) and auto-links an existing Customer for
 * the resolved Contact whenever one exists (§11).
 */
@Injectable()
export class LeadService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly contactRepository: ContactRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly userRepository: UserRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Method 3 (customerId) > Method 2 (contactId) > Method 1 (mobileNumber)
   * when more than one is supplied — see create-lead.dto.ts. Every method
   * ends by checking whether a Customer already exists for the resolved
   * Contact (§11) and auto-linking it, even when the caller didn't supply
   * customerId directly.
   */
  async create(workspaceId: string, dto: CreateLeadDto, actorId: string): Promise<LeadSummary> {
    let contactId: string;
    let customerId: string | null = null;

    if (dto.customerId) {
      const customer = await this.customerRepository.findByIdForWorkspace(
        workspaceId,
        dto.customerId,
      );
      if (!customer) {
        throw new NotFoundException("Customer not found");
      }
      contactId = customer.contactId.toString();
      customerId = customer._id.toString();
    } else if (dto.contactId) {
      const contact = await this.contactRepository.findByIdForWorkspace(workspaceId, dto.contactId);
      if (!contact) {
        throw new NotFoundException("Contact not found");
      }
      contactId = contact._id.toString();
    } else {
      // DTO validation guarantees mobileNumber is present at this point.
      const contact = await this.contactRepository.findOrCreate(
        workspaceId,
        dto.mobileNumber!,
        null,
      );
      contactId = contact._id.toString();
    }

    if (!customerId) {
      const existingCustomer = await this.customerRepository.findByContactForWorkspace(
        workspaceId,
        contactId,
      );
      if (existingCustomer) {
        customerId = existingCustomer._id.toString();
      }
    }

    const existingActiveLead = await this.leadRepository.findActiveByContactForWorkspace(
      workspaceId,
      contactId,
    );
    if (existingActiveLead) {
      throw new ConflictException("An active Lead already exists for this Contact");
    }

    const contact = await this.contactRepository.findByIdForWorkspace(workspaceId, contactId);
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }

    const created = await this.leadRepository.create({
      workspaceId,
      contactId,
      customerId,
      leadName: dto.leadName,
      mobileNumber: contact.phoneNumber,
      source: dto.source,
      company: dto.company ?? null,
      email: dto.email ?? null,
      industry: dto.industry ?? null,
      expectedValue: dto.expectedValue ?? null,
      notes: dto.notes ?? null,
      createdBy: actorId,
    });

    this.eventEmitter.emit(DomainEvent.LEAD_CREATED, {
      workspaceId,
      leadId: created._id.toString(),
      contactId,
      customerId,
      source: dto.source,
      createdBy: actorId,
      occurredAt: new Date().toISOString(),
    } satisfies LeadCreatedPayload);

    return toLeadSummary(created);
  }

  async getById(workspaceId: string, id: string): Promise<LeadSummary> {
    const lead = await this.findOrThrow(workspaceId, id);
    return toLeadSummary(lead);
  }

  async list(workspaceId: string, options: ListLeadsOptions): Promise<Paginated<LeadSummary>> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit =
      options.limit && options.limit > 0
        ? Math.min(options.limit, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;
    const sortBy = options.sortBy ?? "createdAt";
    const sortOrder = options.sortOrder === "asc" ? 1 : -1;

    const { items, total } = await this.leadRepository.list(
      workspaceId,
      {
        status: options.status,
        source: options.source,
        assignedUserId: options.assignedUserId,
        q: options.q,
      },
      sortBy,
      sortOrder,
      page,
      limit,
    );

    return {
      items: items.map(toLeadSummary),
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
   * Lead Editing Policy — archived is read-only (ADR-CRM-004, same rule as
   * Customer's). A converted Lead is also read-only (BR-006, PRD-004
   * Volume-3 §14): conversion is the terminal event in a Lead's lifecycle,
   * and its Deal is the authoritative record going forward.
   */
  async update(
    workspaceId: string,
    id: string,
    dto: UpdateLeadDto,
    actorId: string,
  ): Promise<LeadSummary> {
    const lead = await this.findOrThrow(workspaceId, id);
    if (lead.archivedAt) {
      throw new BadRequestException("An archived Lead is read-only");
    }
    if (lead.convertedAt) {
      throw new BadRequestException("A converted Lead is read-only");
    }

    const updated = await this.leadRepository.update(workspaceId, id, dto, actorId);
    if (!updated) {
      throw new NotFoundException("Lead not found");
    }

    this.eventEmitter.emit(DomainEvent.LEAD_UPDATED, {
      workspaceId,
      leadId: id,
      updatedBy: actorId,
      occurredAt: new Date().toISOString(),
    } satisfies LeadUpdatedPayload);

    return toLeadSummary(updated);
  }

  /** §10 — assignedUserId null unassigns; only ACTIVE SALES_EXECUTIVE members of this Workspace are eligible assignees. */
  async assign(
    workspaceId: string,
    id: string,
    assignedUserId: string | null,
    actorId: string,
  ): Promise<LeadSummary> {
    const lead = await this.findOrThrow(workspaceId, id);
    if (lead.archivedAt) {
      throw new BadRequestException("An archived Lead is read-only");
    }
    if (lead.convertedAt) {
      throw new BadRequestException("A converted Lead is read-only");
    }

    if (assignedUserId) {
      const assignee = await this.userRepository.findById(assignedUserId);
      if (
        !assignee ||
        assignee.workspaceId !== workspaceId ||
        assignee.workspaceMemberStatus !== WorkspaceMemberStatus.ACTIVE
      ) {
        throw new BadRequestException("Assignee must be an active member of this workspace");
      }
      if (!assignee.role || !LEAD_ELIGIBLE_ASSIGNEE_ROLES.includes(assignee.role as never)) {
        throw new BadRequestException("Assignee must be a Sales Executive");
      }
    }

    const updated = await this.leadRepository.updateAssignment(
      workspaceId,
      id,
      assignedUserId,
      actorId,
    );
    if (!updated) {
      throw new NotFoundException("Lead not found");
    }

    this.eventEmitter.emit(
      assignedUserId ? DomainEvent.LEAD_ASSIGNED : DomainEvent.LEAD_UNASSIGNED,
      {
        workspaceId,
        leadId: id,
        assignedUserId,
        actorId,
        occurredAt: new Date().toISOString(),
      } satisfies LeadAssignedPayload,
    );

    return toLeadSummary(updated);
  }

  /** §7/§8 — enforces LEAD_STATUS_TRANSITIONS; BR-010 guarantees an event per change (a named milestone event for QUALIFIED/WON/LOST, LEAD_STATUS_CHANGED otherwise). */
  async updateStatus(
    workspaceId: string,
    id: string,
    newStatus: LeadStatus,
    actorId: string,
  ): Promise<LeadSummary> {
    const lead = await this.findOrThrow(workspaceId, id);
    if (lead.archivedAt) {
      throw new BadRequestException("An archived Lead is read-only");
    }
    if (lead.convertedAt) {
      throw new BadRequestException("A converted Lead is read-only");
    }

    const allowed = LEAD_STATUS_TRANSITIONS[lead.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`Cannot move a ${lead.status} Lead to ${newStatus}`);
    }

    const updated = await this.leadRepository.updateStatus(workspaceId, id, newStatus, actorId);
    if (!updated) {
      throw new NotFoundException("Lead not found");
    }

    this.eventEmitter.emit(MILESTONE_STATUS_EVENTS[newStatus] ?? DomainEvent.LEAD_STATUS_CHANGED, {
      workspaceId,
      leadId: id,
      previousStatus: lead.status,
      newStatus,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies LeadStatusChangedPayload);

    return toLeadSummary(updated);
  }

  /** BR-008 — soft delete only, independent of status (§19/§17, resolved 2026-08-06). */
  async archive(workspaceId: string, id: string, actorId: string): Promise<LeadSummary> {
    const lead = await this.findOrThrow(workspaceId, id);
    if (lead.archivedAt) {
      throw new BadRequestException("Lead is already archived");
    }
    if (lead.convertedAt) {
      throw new BadRequestException("A converted Lead is read-only");
    }

    const updated = await this.leadRepository.archive(workspaceId, id, actorId);
    if (!updated) {
      throw new NotFoundException("Lead not found");
    }

    this.eventEmitter.emit(DomainEvent.LEAD_ARCHIVED, {
      workspaceId,
      leadId: id,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies LeadArchivedPayload);

    return toLeadSummary(updated);
  }

  private async findOrThrow(workspaceId: string, id: string): Promise<LeadDocument> {
    const lead = await this.leadRepository.findByIdForWorkspace(workspaceId, id);
    if (!lead) {
      throw new NotFoundException("Lead not found");
    }
    return lead;
  }
}
