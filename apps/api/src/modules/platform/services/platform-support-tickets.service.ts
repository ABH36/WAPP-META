import { BadRequestException, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  ListSupportTicketsFilter,
  SupportTicketRepository,
} from "../repositories/support-ticket.repository.js";
import { toSupportTicketSummary } from "../mappers/platform.mapper.js";
import type { SupportTicketSummary } from "../platform.types.js";
import {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "../schemas/support-ticket.schema.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  SupportTicketCreatedPayload,
  SupportTicketResolvedPayload,
} from "../../../common/events/domain-events.js";

export interface UpdateSupportTicketFields {
  status?: SupportTicketStatus;
  assignedOperator?: string;
  resolution?: string;
}

/**
 * PRD-007 Volume-2 §4.6 — BR-005: never modifies Billing/CRM/Workspace
 * entities. `CLOSED` is the one terminal state enforced here — every other
 * transition (including reopening a RESOLVED ticket, or moving back from
 * WAITING_CUSTOMER to IN_PROGRESS) is allowed, since a real support queue
 * routinely needs to move backward, and §4.6's lifecycle diagram wasn't
 * specified precisely enough to justify a stricter state machine. See
 * docs/ADR-PLAT-004-support-ticket-lifecycle-strategy.md.
 */
@Injectable()
export class PlatformSupportTicketsService {
  constructor(
    private readonly supportTicketRepository: SupportTicketRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    workspaceId: string,
    title: string,
    category: SupportTicketCategory,
    priority: SupportTicketPriority,
    actorId: string,
  ): Promise<SupportTicketSummary> {
    const created = await this.supportTicketRepository.create({
      workspaceId,
      title,
      category,
      priority,
      createdBy: actorId,
    });

    const payload: SupportTicketCreatedPayload = {
      workspaceId,
      ticketId: created._id.toString(),
      category,
      priority,
      actorId,
      occurredAt: new Date().toISOString(),
    };
    this.eventEmitter.emit(DomainEvent.SUPPORT_TICKET_CREATED, payload);

    return toSupportTicketSummary(created);
  }

  async list(filter: ListSupportTicketsFilter): Promise<SupportTicketSummary[]> {
    const tickets = await this.supportTicketRepository.list(filter);
    return tickets.map(toSupportTicketSummary);
  }

  async update(
    id: string,
    fields: UpdateSupportTicketFields,
    actorId: string,
  ): Promise<SupportTicketSummary> {
    const existing = await this.findOrThrow(id);
    if (existing.status === SupportTicketStatus.CLOSED) {
      throw new BadRequestException("A closed Support Ticket cannot be modified");
    }
    if (
      fields.status === SupportTicketStatus.RESOLVED &&
      !fields.resolution &&
      !existing.resolution
    ) {
      throw new BadRequestException("A resolution is required to resolve a Support Ticket");
    }

    const updated = await this.supportTicketRepository.update(id, fields);
    if (!updated) {
      throw new BadRequestException("Support Ticket not found");
    }

    if (fields.status === SupportTicketStatus.RESOLVED) {
      const payload: SupportTicketResolvedPayload = {
        workspaceId: updated.workspaceId,
        ticketId: id,
        actorId,
        occurredAt: new Date().toISOString(),
      };
      this.eventEmitter.emit(DomainEvent.SUPPORT_TICKET_RESOLVED, payload);
    }

    return toSupportTicketSummary(updated);
  }

  private async findOrThrow(id: string) {
    const ticket = await this.supportTicketRepository.findById(id);
    if (!ticket) {
      throw new BadRequestException("Support Ticket not found");
    }
    return ticket;
  }
}
