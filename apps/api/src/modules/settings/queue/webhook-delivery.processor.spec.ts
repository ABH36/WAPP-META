import { Test } from "@nestjs/testing";
import type { Job } from "bullmq";
import { WebhookEventType } from "@wapp/shared-types";
import { WebhookDeliveryProcessor } from "./webhook-delivery.processor.js";
import { WebhookConfigRepository } from "../repositories/webhook-config.repository.js";
import { WebhookDeliveryLogRepository } from "../repositories/webhook-delivery-log.repository.js";
import { TokenEncryptionService } from "../../../common/security/token-encryption.service.js";
import { CorrelationContextService } from "../../../common/observability/correlation-context.service.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";
import type { WebhookDeliveryJob } from "./webhook-delivery.service.js";

function fakeJob(data: WebhookDeliveryJob): Job<WebhookDeliveryJob> {
  return { data, attemptsMade: 0, opts: {} } as unknown as Job<WebhookDeliveryJob>;
}

describe("WebhookDeliveryProcessor", () => {
  let processor: WebhookDeliveryProcessor;
  let webhookConfigRepository: jest.Mocked<WebhookConfigRepository>;
  let deliveryLogRepository: jest.Mocked<WebhookDeliveryLogRepository>;
  let tokenEncryption: jest.Mocked<TokenEncryptionService>;
  let fetchMock: jest.Mock;

  const jobData: WebhookDeliveryJob = {
    webhookId: "webhook-1",
    workspaceId: "workspace-1",
    event: WebhookEventType.LEAD_CREATED,
    payload: { workspaceId: "workspace-1", leadId: "lead-1" },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhookDeliveryProcessor,
        {
          provide: WebhookConfigRepository,
          useValue: { findByIdWithSecret: jest.fn(), recordDeliveryResult: jest.fn() },
        },
        { provide: WebhookDeliveryLogRepository, useValue: { record: jest.fn() } },
        { provide: TokenEncryptionService, useValue: { decrypt: jest.fn() } },
        CorrelationContextService,
        MetricsService,
      ],
    }).compile();

    processor = moduleRef.get(WebhookDeliveryProcessor);
    webhookConfigRepository = moduleRef.get(WebhookConfigRepository);
    deliveryLogRepository = moduleRef.get(WebhookDeliveryLogRepository);
    tokenEncryption = moduleRef.get(TokenEncryptionService);

    fetchMock = jest.fn();
    global.fetch = fetchMock as never;
  });

  it("does nothing when the webhook was deleted or disabled since the job was queued", async () => {
    webhookConfigRepository.findByIdWithSecret.mockResolvedValue(null);
    await processor.process(fakeJob(jobData));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs the payload with HMAC-SHA256 and records a successful delivery", async () => {
    webhookConfigRepository.findByIdWithSecret.mockResolvedValue({
      url: "https://example.com/hooks/wapp",
      secretEncrypted: "encrypted-secret",
      enabled: true,
      timeoutSeconds: 30,
    } as never);
    tokenEncryption.decrypt.mockReturnValue("raw-secret");
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await processor.process(fakeJob(jobData));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/hooks/wapp",
      expect.objectContaining({ method: "POST" }),
    );
    const [, requestInit] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(requestInit.headers["X-WAPP-Event"]).toBe(WebhookEventType.LEAD_CREATED);
    expect(deliveryLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, statusCode: 200, error: null }),
    );
    expect(webhookConfigRepository.recordDeliveryResult).toHaveBeenCalledWith(
      "webhook-1",
      true,
      null,
    );
  });

  it("records the failure and rethrows (to trigger BullMQ retry) on a non-2xx response", async () => {
    webhookConfigRepository.findByIdWithSecret.mockResolvedValue({
      url: "https://example.com/hooks/wapp",
      secretEncrypted: "encrypted-secret",
      enabled: true,
      timeoutSeconds: 30,
    } as never);
    tokenEncryption.decrypt.mockReturnValue("raw-secret");
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(processor.process(fakeJob(jobData))).rejects.toThrow("HTTP 500");
    expect(deliveryLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, statusCode: 500, error: "HTTP 500" }),
    );
  });

  it("records the failure and rethrows on a network error (e.g. timeout abort)", async () => {
    webhookConfigRepository.findByIdWithSecret.mockResolvedValue({
      url: "https://example.com/hooks/wapp",
      secretEncrypted: "encrypted-secret",
      enabled: true,
      timeoutSeconds: 30,
    } as never);
    tokenEncryption.decrypt.mockReturnValue("raw-secret");
    fetchMock.mockRejectedValue(new Error("The operation was aborted"));

    await expect(processor.process(fakeJob(jobData))).rejects.toThrow("The operation was aborted");
    expect(webhookConfigRepository.recordDeliveryResult).toHaveBeenCalledWith(
      "webhook-1",
      false,
      "The operation was aborted",
    );
  });
});
