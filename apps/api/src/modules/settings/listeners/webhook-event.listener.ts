import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { WebhookEventType } from "@wapp/shared-types";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  CampaignCompletedPayload,
  CustomerCreatedPayload,
  DealStageChangedPayload,
  InvoicePaidPayload,
  LeadCreatedPayload,
  MessageReceivedPayload,
} from "../../../common/events/domain-events.js";
import { WebhookConfigRepository } from "../repositories/webhook-config.repository.js";
import { WebhookDeliveryService } from "../queue/webhook-delivery.service.js";

/**
 * PRD-006 Volume-3 §4.3 — one `@OnEvent` per subscribable business event
 * (same one-listener-method-per-event convention as
 * billing/listeners/billing-history.listener.ts), mapping each to the
 * matching WebhookEventType and fanning out to every enabled, subscribed
 * webhook in that event's workspace. Business modules never call Settings
 * directly — they only ever emit the domain event they already emit today;
 * this listener is the sole place that turns "a business thing happened"
 * into "deliver it to configured webhooks" (BR-001).
 */
@Injectable()
export class WebhookEventListener {
  constructor(
    private readonly webhookConfigRepository: WebhookConfigRepository,
    private readonly webhookDeliveryService: WebhookDeliveryService,
  ) {}

  @OnEvent(DomainEvent.CUSTOMER_CREATED)
  async onCustomerCreated(payload: CustomerCreatedPayload): Promise<void> {
    await this.dispatch(WebhookEventType.CUSTOMER_CREATED, payload);
  }

  @OnEvent(DomainEvent.LEAD_CREATED)
  async onLeadCreated(payload: LeadCreatedPayload): Promise<void> {
    await this.dispatch(WebhookEventType.LEAD_CREATED, payload);
  }

  @OnEvent(DomainEvent.DEAL_WON)
  async onDealWon(payload: DealStageChangedPayload): Promise<void> {
    await this.dispatch(WebhookEventType.DEAL_WON, payload);
  }

  @OnEvent(DomainEvent.MESSAGE_RECEIVED)
  async onMessageReceived(payload: MessageReceivedPayload): Promise<void> {
    await this.dispatch(WebhookEventType.MESSAGE_RECEIVED, payload);
  }

  @OnEvent(DomainEvent.CAMPAIGN_COMPLETED)
  async onCampaignCompleted(payload: CampaignCompletedPayload): Promise<void> {
    await this.dispatch(WebhookEventType.CAMPAIGN_COMPLETED, payload);
  }

  @OnEvent(DomainEvent.INVOICE_PAID)
  async onInvoicePaid(payload: InvoicePaidPayload): Promise<void> {
    await this.dispatch(WebhookEventType.INVOICE_PAID, payload);
  }

  private async dispatch(
    event: WebhookEventType,
    payload: { workspaceId: string } & object,
  ): Promise<void> {
    const webhooks = await this.webhookConfigRepository.findActiveByWorkspaceAndEvent(
      payload.workspaceId,
      event,
    );
    for (const webhook of webhooks) {
      await this.webhookDeliveryService.enqueue(
        { webhookId: webhook._id.toString(), workspaceId: payload.workspaceId, event, payload },
        webhook.retryCount + 1,
      );
    }
  }
}
