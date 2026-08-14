import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CustomerSource, LeadStatus, READ_ONLY_WORKSPACE_STATUSES } from "@wapp/shared-types";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  CustomerCreatedFromLeadPayload,
  DealCreatedFromLeadPayload,
  LeadConvertedPayload,
} from "../../../common/events/domain-events.js";
import { LeadRepository } from "../repositories/lead.repository.js";
import { CustomerRepository } from "../repositories/customer.repository.js";
import { DealRepository } from "../repositories/deal.repository.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import type { LeadConversionResult } from "../crm.types.js";
import type { LeadDocument } from "../schemas/lead.schema.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

/**
 * PRD-004 Volume-3 (Lead Conversion). Owns only the conversion workflow
 * (§3) — no persistent entity of its own. Runs Customer resolution/
 * creation, Deal creation, and marking the Lead converted inside a single
 * Mongo transaction (BR-008) — see
 * docs/ADR-CRM-009-lead-conversion-strategy.md and
 * docs/ADR-INFRA-001-mongo-replica-set-strategy.md for why that's possible
 * in this environment at all.
 */
@Injectable()
export class LeadConversionService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly leadRepository: LeadRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly dealRepository: DealRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {}

  async convert(
    workspaceId: string,
    leadId: string,
    actorId: string,
  ): Promise<LeadConversionResult> {
    const lead = await this.leadRepository.findByIdForWorkspace(workspaceId, leadId);
    if (!lead) {
      throw new NotFoundException("Lead not found");
    }

    // §10 — idempotent: a repeat request never creates a second Deal. The
    // global HttpExceptionFilter (TAD-001 API-002) only forwards an
    // exception's `message` to the client, so the existing conversion
    // result (dealId/customerId/convertedAt) can't ride along on this error
    // body — callers get it from GET /crm/leads/:id instead, which already
    // exposes those fields.
    if (lead.convertedAt) {
      throw new ConflictException("Lead has already been converted");
    }
    if (lead.archivedAt) {
      throw new BadRequestException("An archived Lead cannot be converted");
    }
    if (lead.status !== LeadStatus.WON) {
      throw new BadRequestException("Only a WON Lead may be converted");
    }

    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }
    // §4 "Workspace is Active" — reused verbatim from the already-approved
    // canonical access mapping (packages/shared-types/enums/workspace-status.enum.ts,
    // ADR-017: TRIAL and ACTIVE both mean full access; EXPIRED is read-only
    // and blocks CRM editing explicitly). Not yet enforced anywhere else in
    // this codebase — see docs/ADR-CRM-009-lead-conversion-strategy.md.
    if (READ_ONLY_WORKSPACE_STATUSES.includes(workspace.status)) {
      throw new BadRequestException("Workspace is read-only; Lead cannot be converted");
    }

    const session = await this.connection.startSession();
    let customerId: string;
    let dealId: string;
    let customerCreatedNew = false;
    const now = new Date();

    try {
      await session.withTransaction(async () => {
        if (lead.customerId) {
          customerId = lead.customerId.toString();
        } else {
          const customer = await this.customerRepository.create(
            {
              workspaceId,
              contactId: lead.contactId.toString(),
              customerName: lead.leadName,
              mobileNumber: lead.mobileNumber,
              source: CustomerSource.LEAD_CONVERSION,
              companyName: lead.company,
              email: lead.email,
              gstNumber: null,
              address: null,
              city: null,
              state: null,
              country: null,
              postalCode: null,
              website: null,
              industry: lead.industry,
              notes: null,
              createdBy: actorId,
            },
            session,
          );
          customerId = customer._id.toString();
          customerCreatedNew = true;
        }

        const deal = await this.dealRepository.create(
          {
            workspaceId,
            contactId: lead.contactId.toString(),
            customerId,
            sourceLeadId: leadId,
            // §5 — carried forward from the converting Lead (PRD-004
            // Volume-4, resolved 2026-08-06): the Deal starts with the same
            // descriptive name and, if the Lead was already assigned, the
            // same assignee — see docs/ADR-CRM-012-deal-lifecycle-strategy.md.
            title: lead.leadName,
            assignedTo: lead.assignedUserId,
            createdBy: actorId,
          },
          session,
        );
        dealId = deal._id.toString();

        const updated = await this.leadRepository.markConverted(
          workspaceId,
          leadId,
          customerId,
          dealId,
          actorId,
          session,
        );
        if (!updated) {
          throw new NotFoundException("Lead not found");
        }
      });
    } finally {
      await session.endSession();
    }

    this.emitEvents(workspaceId, lead, customerId!, dealId!, actorId, customerCreatedNew, now);
    this.metricsService.crmLeadConversionsTotal.inc();
    this.metricsService.crmDealsCreatedTotal.inc();

    return {
      leadId,
      customerId: customerId!,
      dealId: dealId!,
      convertedAt: now.toISOString(),
    };
  }

  private emitEvents(
    workspaceId: string,
    lead: LeadDocument,
    customerId: string,
    dealId: string,
    actorId: string,
    customerCreatedNew: boolean,
    occurredAt: Date,
  ): void {
    if (customerCreatedNew) {
      this.eventEmitter.emit(DomainEvent.CUSTOMER_CREATED_FROM_LEAD, {
        workspaceId,
        customerId,
        contactId: lead.contactId.toString(),
        sourceLeadId: lead._id.toString(),
        createdBy: actorId,
        occurredAt: occurredAt.toISOString(),
      } satisfies CustomerCreatedFromLeadPayload);
    }

    this.eventEmitter.emit(DomainEvent.DEAL_CREATED_FROM_LEAD, {
      workspaceId,
      dealId,
      contactId: lead.contactId.toString(),
      customerId,
      sourceLeadId: lead._id.toString(),
      createdBy: actorId,
      occurredAt: occurredAt.toISOString(),
    } satisfies DealCreatedFromLeadPayload);

    this.eventEmitter.emit(DomainEvent.LEAD_CONVERTED, {
      workspaceId,
      leadId: lead._id.toString(),
      customerId,
      dealId,
      convertedBy: actorId,
      occurredAt: occurredAt.toISOString(),
    } satisfies LeadConvertedPayload);
  }
}
