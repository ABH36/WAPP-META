import { Test } from "@nestjs/testing";
import { WebhookEventType } from "@wapp/shared-types";
import { WebhookEventListener } from "./webhook-event.listener.js";
import { WebhookConfigRepository } from "../repositories/webhook-config.repository.js";
import { WebhookDeliveryService } from "../queue/webhook-delivery.service.js";

describe("WebhookEventListener", () => {
  let listener: WebhookEventListener;
  let webhookConfigRepository: jest.Mocked<WebhookConfigRepository>;
  let webhookDeliveryService: jest.Mocked<WebhookDeliveryService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhookEventListener,
        {
          provide: WebhookConfigRepository,
          useValue: { findActiveByWorkspaceAndEvent: jest.fn() },
        },
        { provide: WebhookDeliveryService, useValue: { enqueue: jest.fn() } },
      ],
    }).compile();

    listener = moduleRef.get(WebhookEventListener);
    webhookConfigRepository = moduleRef.get(WebhookConfigRepository);
    webhookDeliveryService = moduleRef.get(WebhookDeliveryService);
  });

  it("enqueues one delivery per active, subscribed webhook with attempts = retryCount + 1", async () => {
    webhookConfigRepository.findActiveByWorkspaceAndEvent.mockResolvedValue([
      { _id: { toString: () => "webhook-1" }, retryCount: 3 } as never,
      { _id: { toString: () => "webhook-2" }, retryCount: 0 } as never,
    ]);

    await listener.onLeadCreated({
      workspaceId: "workspace-1",
      leadId: "lead-1",
      contactId: "contact-1",
      customerId: null,
      source: "MANUAL",
      createdBy: "user-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });

    expect(webhookConfigRepository.findActiveByWorkspaceAndEvent).toHaveBeenCalledWith(
      "workspace-1",
      WebhookEventType.LEAD_CREATED,
    );
    expect(webhookDeliveryService.enqueue).toHaveBeenCalledTimes(2);
    expect(webhookDeliveryService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ webhookId: "webhook-1", event: WebhookEventType.LEAD_CREATED }),
      4,
    );
    expect(webhookDeliveryService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ webhookId: "webhook-2" }),
      1,
    );
  });

  it("enqueues nothing when no webhook subscribes to the event", async () => {
    webhookConfigRepository.findActiveByWorkspaceAndEvent.mockResolvedValue([]);

    await listener.onInvoicePaid({
      workspaceId: "workspace-1",
      invoiceId: "invoice-1",
      paymentId: "payment-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });

    expect(webhookDeliveryService.enqueue).not.toHaveBeenCalled();
  });
});
