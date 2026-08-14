import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WebhookEventType } from "@wapp/shared-types";
import { WebhookService } from "./webhook.service.js";
import { WebhookConfigRepository } from "../repositories/webhook-config.repository.js";
import { TokenEncryptionService } from "../../../common/security/token-encryption.service.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import { IntegrationConnectionStatus } from "../schemas/integration-status.enum.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

function fakeWebhook(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => "webhook-1" },
    url: "https://example.com/hooks/wapp",
    enabled: true,
    retryCount: 3,
    timeoutSeconds: 30,
    events: [WebhookEventType.LEAD_CREATED],
    status: IntegrationConnectionStatus.CONNECTED,
    lastDeliveryAt: null,
    lastError: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("WebhookService", () => {
  let service: WebhookService;
  let webhookConfigRepository: jest.Mocked<WebhookConfigRepository>;
  let tokenEncryption: jest.Mocked<TokenEncryptionService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: WebhookConfigRepository,
          useValue: {
            findByWorkspace: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        { provide: TokenEncryptionService, useValue: { encrypt: jest.fn(), decrypt: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        MetricsService,
      ],
    }).compile();

    service = moduleRef.get(WebhookService);
    webhookConfigRepository = moduleRef.get(WebhookConfigRepository);
    tokenEncryption = moduleRef.get(TokenEncryptionService);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("create", () => {
    it("encrypts a freshly generated secret, persists it, and returns the raw secret exactly once", async () => {
      tokenEncryption.encrypt.mockReturnValue("encrypted-secret");
      webhookConfigRepository.create.mockResolvedValue(fakeWebhook() as never);

      const result = await service.create("workspace-1", "user-1", {
        url: "https://example.com/hooks/wapp",
        events: [WebhookEventType.LEAD_CREATED],
      });

      expect(webhookConfigRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "workspace-1",
          url: "https://example.com/hooks/wapp",
          secretEncrypted: "encrypted-secret",
          enabled: true,
          retryCount: 3,
          timeoutSeconds: 30,
        }),
      );
      expect(result.secret).toMatch(/^[0-9a-f]{64}$/);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.WEBHOOK_CREATED,
        expect.objectContaining({ workspaceId: "workspace-1", webhookId: "webhook-1" }),
      );
    });
  });

  describe("update", () => {
    it("throws NotFoundException when the webhook doesn't belong to this workspace", async () => {
      webhookConfigRepository.update.mockResolvedValue(null);
      await expect(
        service.update("workspace-1", "user-1", "webhook-1", { enabled: false }),
      ).rejects.toThrow("Webhook not found");
    });

    it("emits WEBHOOK_UPDATED on success", async () => {
      webhookConfigRepository.update.mockResolvedValue(fakeWebhook({ enabled: false }) as never);
      const result = await service.update("workspace-1", "user-1", "webhook-1", { enabled: false });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.WEBHOOK_UPDATED,
        expect.objectContaining({ webhookId: "webhook-1", actorId: "user-1" }),
      );
      expect(result.enabled).toBe(false);
    });
  });

  describe("delete", () => {
    it("throws NotFoundException when nothing was deleted", async () => {
      webhookConfigRepository.delete.mockResolvedValue(false);
      await expect(service.delete("workspace-1", "webhook-1")).rejects.toThrow("Webhook not found");
    });

    it("resolves cleanly when the webhook was deleted", async () => {
      webhookConfigRepository.delete.mockResolvedValue(true);
      await expect(service.delete("workspace-1", "webhook-1")).resolves.toBeUndefined();
    });
  });

  describe("list", () => {
    it("maps every stored webhook to its public summary", async () => {
      webhookConfigRepository.findByWorkspace.mockResolvedValue([fakeWebhook() as never]);
      const result = await service.list("workspace-1");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: "webhook-1", url: "https://example.com/hooks/wapp" });
    });
  });
});
