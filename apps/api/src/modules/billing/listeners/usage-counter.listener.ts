import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { UsageCounterType } from "@wapp/shared-types";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  BroadcastStartedPayload,
  CustomerCreatedPayload,
  DealCreatedFromLeadPayload,
  LeadCreatedPayload,
  MessageSentPayload,
  TeamMemberAcceptedPayload,
} from "../../../common/events/domain-events.js";
import { UsageService } from "../services/usage.service.js";

/**
 * PRD-005 Volume-3 §6 — resolved 2026-08-07 (during implementation): event
 * -driven denormalized counters, per Architecture Review. Only the 6
 * counters with a real creation-time domain event are wired here — Deals
 * can only be created via Lead conversion in this codebase
 * (DEAL_CREATED_FROM_LEAD, ADR-CRM-010, no generic DEAL_CREATED exists);
 * Team Members count on TEAM_MEMBER_ACCEPTED, not INVITED (a pending
 * invite isn't consuming a seat yet); Campaigns/Storage/API Requests have
 * no creation-time event to hook and are deferred — TD-013. See
 * docs/ADR-BILL-007-usage-counter-strategy.md.
 */
@Injectable()
export class UsageCounterListener {
  constructor(private readonly usageService: UsageService) {}

  @OnEvent(DomainEvent.TEAM_MEMBER_ACCEPTED)
  async onTeamMemberAccepted(payload: TeamMemberAcceptedPayload): Promise<void> {
    await this.usageService.recordCreation(payload.workspaceId, UsageCounterType.TEAM_MEMBERS);
  }

  @OnEvent(DomainEvent.CUSTOMER_CREATED)
  async onCustomerCreated(payload: CustomerCreatedPayload): Promise<void> {
    await this.usageService.recordCreation(payload.workspaceId, UsageCounterType.CUSTOMERS);
  }

  @OnEvent(DomainEvent.LEAD_CREATED)
  async onLeadCreated(payload: LeadCreatedPayload): Promise<void> {
    await this.usageService.recordCreation(payload.workspaceId, UsageCounterType.LEADS);
  }

  @OnEvent(DomainEvent.DEAL_CREATED_FROM_LEAD)
  async onDealCreatedFromLead(payload: DealCreatedFromLeadPayload): Promise<void> {
    await this.usageService.recordCreation(payload.workspaceId, UsageCounterType.DEALS);
  }

  @OnEvent(DomainEvent.BROADCAST_STARTED)
  async onBroadcastStarted(payload: BroadcastStartedPayload): Promise<void> {
    await this.usageService.recordCreation(payload.workspaceId, UsageCounterType.BROADCASTS);
  }

  @OnEvent(DomainEvent.MESSAGE_SENT)
  async onMessageSent(payload: MessageSentPayload): Promise<void> {
    await this.usageService.recordCreation(payload.workspaceId, UsageCounterType.MESSAGES);
  }
}
