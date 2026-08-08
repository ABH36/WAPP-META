import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  ApiKeyCreatedPayload,
  ApiKeyRevokedPayload,
  CampaignCompletedPayload,
  CustomerCreatedPayload,
  CustomerStatusChangedPayload,
  DealStageChangedPayload,
  IntegrationConnectedPayload,
  IntegrationDisconnectedPayload,
  InvoicePaidPayload,
  LeadConvertedPayload,
  PaymentFailedPayload,
  SettingsUpdatedPayload,
  SubscriptionCancelledPayload,
  SubscriptionCreatedPayload,
  TeamMemberInvitedPayload,
  TeamOwnershipTransferredPayload,
  WebhookCreatedPayload,
  WhatsAppConnectedPayload,
  WorkspaceCreatedPayload,
  WorkspaceUpdatedPayload,
} from "../../../common/events/domain-events.js";
import { AuditLogRepository } from "../repositories/audit-log.repository.js";
import { AuditCategory, AuditResult } from "../schemas/audit-log-entry.schema.js";

/**
 * PRD-006 Volume-4 §4.1 — one `@OnEvent` handler per covered event, same
 * convention as `billing/listeners/billing-history.listener.ts` (wildcard
 * subscription is documented as unreliable in this codebase, per
 * `domain-event-logger.listener.ts`'s own comment). Covers a curated,
 * representative set per category, not literally every domain event — see
 * docs/ADR-SET-007-audit-strategy.md for the full rationale and exactly
 * which events are (and aren't) covered. AUTHENTICATION has no handler
 * here at all — `AuditLogService` composes it from Identity's own
 * `LoginHistoryEntry` at read time instead.
 */
@Injectable()
export class AuditLogListener {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  // ---- Workspace ----

  @OnEvent(DomainEvent.WORKSPACE_CREATED)
  async onWorkspaceCreated(payload: WorkspaceCreatedPayload): Promise<void> {
    await this.record(payload.workspaceId, AuditCategory.WORKSPACE, payload.ownerId, "Workspace", {
      entityId: payload.workspaceId,
      action: "Workspace Created",
      metadata: { name: payload.name },
    });
  }

  @OnEvent(DomainEvent.WORKSPACE_UPDATED)
  async onWorkspaceUpdated(payload: WorkspaceUpdatedPayload): Promise<void> {
    await this.record(
      payload.workspaceId,
      AuditCategory.WORKSPACE,
      payload.updatedBy,
      "Workspace",
      {
        entityId: payload.workspaceId,
        action: `Workspace Updated (${payload.section})`,
      },
    );
  }

  @OnEvent(DomainEvent.TEAM_MEMBER_INVITED)
  async onTeamMemberInvited(payload: TeamMemberInvitedPayload): Promise<void> {
    await this.record(
      payload.workspaceId,
      AuditCategory.WORKSPACE,
      payload.invitedBy,
      "Workspace",
      {
        entity: "TeamMember",
        action: "Team Member Invited",
        metadata: { email: payload.email, role: payload.role },
      },
    );
  }

  @OnEvent(DomainEvent.TEAM_OWNERSHIP_TRANSFERRED)
  async onTeamOwnershipTransferred(payload: TeamOwnershipTransferredPayload): Promise<void> {
    await this.record(
      payload.workspaceId,
      AuditCategory.WORKSPACE,
      payload.previousOwnerId,
      "Workspace",
      {
        entity: "TeamMember",
        entityId: payload.newOwnerId,
        action: "Ownership Transferred",
      },
    );
  }

  // ---- CRM ----

  @OnEvent(DomainEvent.CUSTOMER_CREATED)
  async onCustomerCreated(payload: CustomerCreatedPayload): Promise<void> {
    await this.record(payload.workspaceId, AuditCategory.CRM, payload.createdBy, "CRM", {
      entity: "Customer",
      entityId: payload.customerId,
      action: "Customer Created",
    });
  }

  @OnEvent(DomainEvent.CUSTOMER_BLOCKED)
  async onCustomerBlocked(payload: CustomerStatusChangedPayload): Promise<void> {
    await this.record(payload.workspaceId, AuditCategory.CRM, payload.actorId, "CRM", {
      entity: "Customer",
      entityId: payload.customerId,
      action: "Customer Blocked",
    });
  }

  @OnEvent(DomainEvent.LEAD_CONVERTED)
  async onLeadConverted(payload: LeadConvertedPayload): Promise<void> {
    await this.record(payload.workspaceId, AuditCategory.CRM, payload.convertedBy, "CRM", {
      entity: "Lead",
      entityId: payload.leadId,
      action: "Lead Converted",
      metadata: { customerId: payload.customerId, dealId: payload.dealId },
    });
  }

  @OnEvent(DomainEvent.DEAL_WON)
  async onDealWon(payload: DealStageChangedPayload): Promise<void> {
    await this.record(payload.workspaceId, AuditCategory.CRM, payload.actorId, "CRM", {
      entity: "Deal",
      entityId: payload.dealId,
      action: "Deal Won",
    });
  }

  // ---- Communication ----

  @OnEvent(DomainEvent.WHATSAPP_CONNECTED)
  async onWhatsAppConnected(payload: WhatsAppConnectedPayload): Promise<void> {
    await this.record(
      payload.workspaceId,
      AuditCategory.COMMUNICATION,
      payload.connectedBy,
      "Communication",
      {
        entity: "WhatsAppConnection",
        entityId: payload.wabaId,
        action: "WhatsApp Connected",
      },
    );
  }

  @OnEvent(DomainEvent.CAMPAIGN_COMPLETED)
  async onCampaignCompleted(payload: CampaignCompletedPayload): Promise<void> {
    // System-detected completion — no acting user.
    await this.record(payload.workspaceId, AuditCategory.COMMUNICATION, null, "Communication", {
      entity: "Campaign",
      entityId: payload.campaignId,
      action: "Campaign Completed",
    });
  }

  // ---- Billing ----

  @OnEvent(DomainEvent.SUBSCRIPTION_CREATED)
  async onSubscriptionCreated(payload: SubscriptionCreatedPayload): Promise<void> {
    // Reactive on WORKSPACE_CREATED — no acting user of its own.
    await this.record(payload.workspaceId, AuditCategory.BILLING, null, "Billing", {
      entity: "Subscription",
      entityId: payload.subscriptionId,
      action: "Subscription Created",
    });
  }

  @OnEvent(DomainEvent.SUBSCRIPTION_CANCELLED)
  async onSubscriptionCancelled(payload: SubscriptionCancelledPayload): Promise<void> {
    await this.record(payload.workspaceId, AuditCategory.BILLING, payload.actorId, "Billing", {
      entity: "Subscription",
      entityId: payload.subscriptionId,
      action: "Subscription Cancelled",
    });
  }

  @OnEvent(DomainEvent.INVOICE_PAID)
  async onInvoicePaid(payload: InvoicePaidPayload): Promise<void> {
    await this.record(payload.workspaceId, AuditCategory.BILLING, null, "Billing", {
      entity: "Invoice",
      entityId: payload.invoiceId,
      action: "Invoice Paid",
    });
  }

  @OnEvent(DomainEvent.PAYMENT_FAILED)
  async onPaymentFailed(payload: PaymentFailedPayload): Promise<void> {
    await this.record(payload.workspaceId, AuditCategory.BILLING, null, "Billing", {
      entity: "Payment",
      entityId: payload.paymentId,
      action: "Payment Failed",
      result: AuditResult.FAILURE,
    });
  }

  // ---- Settings ----

  @OnEvent(DomainEvent.SETTINGS_UPDATED)
  async onSettingsUpdated(payload: SettingsUpdatedPayload): Promise<void> {
    await this.record(payload.workspaceId, AuditCategory.SETTINGS, payload.updatedBy, "Settings", {
      action: `Settings Updated (${payload.section})`,
    });
  }

  // ---- Integrations ----

  @OnEvent(DomainEvent.INTEGRATION_CONNECTED)
  async onIntegrationConnected(payload: IntegrationConnectedPayload): Promise<void> {
    await this.record(
      payload.workspaceId,
      AuditCategory.INTEGRATIONS,
      payload.actorId,
      "Integrations",
      {
        entity: payload.integrationType,
        action: "Integration Connected",
      },
    );
  }

  @OnEvent(DomainEvent.INTEGRATION_DISCONNECTED)
  async onIntegrationDisconnected(payload: IntegrationDisconnectedPayload): Promise<void> {
    await this.record(
      payload.workspaceId,
      AuditCategory.INTEGRATIONS,
      payload.actorId,
      "Integrations",
      {
        entity: payload.integrationType,
        action: "Integration Disconnected",
      },
    );
  }

  @OnEvent(DomainEvent.WEBHOOK_CREATED)
  async onWebhookCreated(payload: WebhookCreatedPayload): Promise<void> {
    await this.record(
      payload.workspaceId,
      AuditCategory.INTEGRATIONS,
      payload.actorId,
      "Integrations",
      {
        entity: "Webhook",
        entityId: payload.webhookId,
        action: "Webhook Created",
      },
    );
  }

  @OnEvent(DomainEvent.API_KEY_CREATED)
  async onApiKeyCreated(payload: ApiKeyCreatedPayload): Promise<void> {
    await this.record(
      payload.workspaceId,
      AuditCategory.INTEGRATIONS,
      payload.actorId,
      "Integrations",
      {
        entity: "ApiKey",
        entityId: payload.apiKeyId,
        action: "API Key Created",
      },
    );
  }

  @OnEvent(DomainEvent.API_KEY_REVOKED)
  async onApiKeyRevoked(payload: ApiKeyRevokedPayload): Promise<void> {
    await this.record(
      payload.workspaceId,
      AuditCategory.INTEGRATIONS,
      payload.actorId,
      "Integrations",
      {
        entity: "ApiKey",
        entityId: payload.apiKeyId,
        action: "API Key Revoked",
      },
    );
  }

  private async record(
    workspaceId: string,
    category: AuditCategory,
    actorId: string | null,
    module: string,
    details: {
      entity?: string;
      entityId?: string;
      action: string;
      result?: AuditResult;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.auditLogRepository.record({
      workspaceId,
      category,
      actorId,
      module,
      entity: details.entity ?? null,
      entityId: details.entityId ?? null,
      action: details.action,
      result: details.result ?? AuditResult.SUCCESS,
      metadata: details.metadata ?? null,
    });
  }
}
