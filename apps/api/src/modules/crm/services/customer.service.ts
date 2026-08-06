import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CustomerSource, CustomerStatus } from "@wapp/shared-types";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  CustomerCreatedPayload,
  CustomerStatusChangedPayload,
  CustomerUpdatedPayload,
} from "../../../common/events/domain-events.js";
import { ContactRepository } from "../../communication/repositories/contact.repository.js";
import { CustomerRepository, type CustomerSortField } from "../repositories/customer.repository.js";
import { toCustomerSummary } from "../mappers/crm.mapper.js";
import type { CustomerSummary } from "../crm.types.js";
import type { CreateCustomerDto } from "../dto/create-customer.dto.js";
import type { UpdateCustomerDto } from "../dto/update-customer.dto.js";
import type { Paginated } from "../../../common/interceptors/response.interceptor.js";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface ListCustomersOptions {
  status?: CustomerStatus;
  source?: CustomerSource;
  q?: string;
  sortBy?: CustomerSortField;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * PRD-004 Volume-1 (Customer Management). Owns the CRM Customer business
 * record; Contact stays Communication-owned (ADR-COMM-002,
 * docs/ADR-CRM-001-customer-identity-strategy.md) — this service resolves/
 * creates a Contact through the exported ContactRepository, it never writes
 * to the `contacts` collection's business fields itself.
 */
@Injectable()
export class CustomerService {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly contactRepository: ContactRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Method 1 (Manual Creation, dto.mobileNumber) resolves/creates the Contact
   * via ContactRepository.findOrCreate and is always source=MANUAL_ENTRY.
   * Method 3 (Convert Existing Contact, dto.contactId) always source=WHATSAPP
   * — the only way a Contact exists at all today is an inbound/outbound
   * WhatsApp message (see contact.repository.ts), so "convert an existing
   * Contact" and "this relationship started on WhatsApp" are the same fact.
   * If both are supplied, contactId wins (Method 3 takes precedence) — see
   * create-customer.dto.ts's own doc comment.
   */
  async create(
    workspaceId: string,
    dto: CreateCustomerDto,
    actorId: string,
  ): Promise<CustomerSummary> {
    let contactId: string;
    let mobileNumber: string;
    let source: CustomerSource;

    if (dto.contactId) {
      const contact = await this.contactRepository.findByIdForWorkspace(workspaceId, dto.contactId);
      if (!contact) {
        throw new NotFoundException("Contact not found");
      }
      contactId = contact._id.toString();
      mobileNumber = contact.phoneNumber;
      source = CustomerSource.WHATSAPP;
    } else {
      // DTO validation guarantees mobileNumber is present when contactId isn't.
      const contact = await this.contactRepository.findOrCreate(
        workspaceId,
        dto.mobileNumber!,
        null,
      );
      contactId = contact._id.toString();
      mobileNumber = contact.phoneNumber;
      source = CustomerSource.MANUAL_ENTRY;
    }

    const existing = await this.customerRepository.findByContactForWorkspace(
      workspaceId,
      contactId,
    );
    if (existing) {
      throw new ConflictException("A Customer already exists for this Contact");
    }

    const created = await this.customerRepository.create({
      workspaceId,
      contactId,
      customerName: dto.customerName,
      mobileNumber,
      source,
      companyName: dto.companyName ?? null,
      email: dto.email ?? null,
      gstNumber: dto.gstNumber ?? null,
      address: dto.address ?? null,
      city: dto.city ?? null,
      state: dto.state ?? null,
      country: dto.country ?? null,
      postalCode: dto.postalCode ?? null,
      website: dto.website ?? null,
      industry: dto.industry ?? null,
      notes: dto.notes ?? null,
      createdBy: actorId,
    });

    this.eventEmitter.emit(DomainEvent.CUSTOMER_CREATED, {
      workspaceId,
      customerId: created._id.toString(),
      contactId,
      source,
      createdBy: actorId,
      occurredAt: new Date().toISOString(),
    } satisfies CustomerCreatedPayload);

    return toCustomerSummary(created);
  }

  async getById(workspaceId: string, id: string): Promise<CustomerSummary> {
    const customer = await this.findOrThrow(workspaceId, id);
    return toCustomerSummary(customer);
  }

  async list(
    workspaceId: string,
    options: ListCustomersOptions,
  ): Promise<Paginated<CustomerSummary>> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit =
      options.limit && options.limit > 0
        ? Math.min(options.limit, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;
    const sortBy = options.sortBy ?? "createdAt";
    const sortOrder = options.sortOrder === "asc" ? 1 : -1;

    const { items, total } = await this.customerRepository.list(
      workspaceId,
      { status: options.status, source: options.source, q: options.q },
      sortBy,
      sortOrder,
      page,
      limit,
    );

    return {
      items: items.map(toCustomerSummary),
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
   * Customer Editing Policy (ADR-CRM-004, resolved 2026-08-06): ACTIVE and
   * BLOCKED are editable; ARCHIVED is read-only for general updates — the
   * record stays searchable/referencable/reportable, but business-profile
   * fields can no longer change. Status itself is never touched here (see
   * transitionStatus for the dedicated block/activate/archive endpoints).
   */
  async update(
    workspaceId: string,
    id: string,
    dto: UpdateCustomerDto,
    actorId: string,
  ): Promise<CustomerSummary> {
    const customer = await this.findOrThrow(workspaceId, id);
    if (customer.status === CustomerStatus.ARCHIVED) {
      throw new BadRequestException("An archived Customer is read-only");
    }

    const updated = await this.customerRepository.update(workspaceId, id, dto, actorId);
    if (!updated) {
      throw new NotFoundException("Customer not found");
    }

    this.eventEmitter.emit(DomainEvent.CUSTOMER_UPDATED, {
      workspaceId,
      customerId: id,
      updatedBy: actorId,
      occurredAt: new Date().toISOString(),
    } satisfies CustomerUpdatedPayload);

    return toCustomerSummary(updated);
  }

  /** §5/§7 — ACTIVE -> BLOCKED only. */
  async block(workspaceId: string, id: string, actorId: string): Promise<CustomerSummary> {
    return this.transitionStatus(
      workspaceId,
      id,
      actorId,
      [CustomerStatus.ACTIVE],
      CustomerStatus.BLOCKED,
      DomainEvent.CUSTOMER_BLOCKED,
    );
  }

  /** §5/§7 — BLOCKED -> ACTIVE only. */
  async activate(workspaceId: string, id: string, actorId: string): Promise<CustomerSummary> {
    return this.transitionStatus(
      workspaceId,
      id,
      actorId,
      [CustomerStatus.BLOCKED],
      CustomerStatus.ACTIVE,
      DomainEvent.CUSTOMER_ACTIVATED,
    );
  }

  /** §5/§7 — ACTIVE or BLOCKED -> ARCHIVED (terminal). */
  async archive(workspaceId: string, id: string, actorId: string): Promise<CustomerSummary> {
    return this.transitionStatus(
      workspaceId,
      id,
      actorId,
      [CustomerStatus.ACTIVE, CustomerStatus.BLOCKED],
      CustomerStatus.ARCHIVED,
      DomainEvent.CUSTOMER_ARCHIVED,
    );
  }

  private async transitionStatus(
    workspaceId: string,
    id: string,
    actorId: string,
    allowedFrom: CustomerStatus[],
    to: CustomerStatus,
    event: (typeof DomainEvent)[keyof typeof DomainEvent],
  ): Promise<CustomerSummary> {
    const customer = await this.findOrThrow(workspaceId, id);
    if (!allowedFrom.includes(customer.status)) {
      throw new BadRequestException(`Cannot move a ${customer.status} Customer to ${to}`);
    }

    const updated = await this.customerRepository.updateStatus(workspaceId, id, to, actorId);
    if (!updated) {
      throw new NotFoundException("Customer not found");
    }

    this.eventEmitter.emit(event, {
      workspaceId,
      customerId: id,
      previousStatus: customer.status,
      newStatus: to,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies CustomerStatusChangedPayload);

    return toCustomerSummary(updated);
  }

  private async findOrThrow(workspaceId: string, id: string) {
    const customer = await this.customerRepository.findByIdForWorkspace(workspaceId, id);
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return customer;
  }
}
