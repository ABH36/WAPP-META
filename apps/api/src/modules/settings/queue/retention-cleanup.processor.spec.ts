import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { RetentionCleanupProcessor } from "./retention-cleanup.processor.js";
import { RetentionPolicyRepository } from "../repositories/retention-policy.repository.js";
import { AuditLogRepository } from "../repositories/audit-log.repository.js";
import { WebhookDeliveryLogRepository } from "../repositories/webhook-delivery-log.repository.js";
import { AuthService } from "../../identity/services/auth.service.js";
import { RETENTION_CLEANUP_QUEUE } from "./retention-cleanup.constants.js";

describe("RetentionCleanupProcessor", () => {
  let processor: RetentionCleanupProcessor;
  let retentionPolicyRepository: jest.Mocked<RetentionPolicyRepository>;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;
  let webhookDeliveryLogRepository: jest.Mocked<WebhookDeliveryLogRepository>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RetentionCleanupProcessor,
        { provide: RetentionPolicyRepository, useValue: { findAll: jest.fn() } },
        { provide: AuditLogRepository, useValue: { deleteOlderThan: jest.fn() } },
        { provide: WebhookDeliveryLogRepository, useValue: { deleteOlderThan: jest.fn() } },
        { provide: AuthService, useValue: { cleanupLoginHistory: jest.fn() } },
        { provide: getQueueToken(RETENTION_CLEANUP_QUEUE), useValue: { add: jest.fn() } },
      ],
    }).compile();

    processor = moduleRef.get(RetentionCleanupProcessor);
    retentionPolicyRepository = moduleRef.get(RetentionPolicyRepository);
    auditLogRepository = moduleRef.get(AuditLogRepository);
    webhookDeliveryLogRepository = moduleRef.get(WebhookDeliveryLogRepository);
    authService = moduleRef.get(AuthService);
  });

  it("cleans up every workspace's own retention-configured collections", async () => {
    retentionPolicyRepository.findAll.mockResolvedValue([
      {
        workspaceId: "workspace-1",
        auditLogRetentionDays: 365,
        loginHistoryRetentionDays: 365,
        notificationHistoryRetentionDays: 365,
        webhookDeliveryLogRetentionDays: 365,
      } as never,
    ]);
    auditLogRepository.deleteOlderThan.mockResolvedValue(2);
    authService.cleanupLoginHistory.mockResolvedValue(1);
    webhookDeliveryLogRepository.deleteOlderThan.mockResolvedValue(0);

    await processor.process({} as Job<unknown>);

    expect(auditLogRepository.deleteOlderThan).toHaveBeenCalledWith(
      "workspace-1",
      expect.any(Date),
    );
    expect(authService.cleanupLoginHistory).toHaveBeenCalledWith("workspace-1", expect.any(Date));
    expect(webhookDeliveryLogRepository.deleteOlderThan).toHaveBeenCalledWith(
      "workspace-1",
      expect.any(Date),
    );
  });

  it("isolates one workspace's failure from the rest of the sweep", async () => {
    retentionPolicyRepository.findAll.mockResolvedValue([
      {
        workspaceId: "workspace-1",
        auditLogRetentionDays: 365,
        loginHistoryRetentionDays: 365,
        notificationHistoryRetentionDays: 365,
        webhookDeliveryLogRetentionDays: 365,
      } as never,
      {
        workspaceId: "workspace-2",
        auditLogRetentionDays: 365,
        loginHistoryRetentionDays: 365,
        notificationHistoryRetentionDays: 365,
        webhookDeliveryLogRetentionDays: 365,
      } as never,
    ]);
    auditLogRepository.deleteOlderThan
      .mockRejectedValueOnce(new Error("Mongo timeout"))
      .mockResolvedValueOnce(0);
    authService.cleanupLoginHistory.mockResolvedValue(0);
    webhookDeliveryLogRepository.deleteOlderThan.mockResolvedValue(0);

    await expect(processor.process({} as Job<unknown>)).resolves.toBeUndefined();

    expect(auditLogRepository.deleteOlderThan).toHaveBeenCalledTimes(2);
    expect(authService.cleanupLoginHistory).toHaveBeenCalledWith("workspace-2", expect.any(Date));
  });
});
