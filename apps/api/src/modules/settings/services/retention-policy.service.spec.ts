import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { RetentionPolicyService } from "./retention-policy.service.js";
import { RetentionPolicyRepository } from "../repositories/retention-policy.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

describe("RetentionPolicyService", () => {
  let service: RetentionPolicyService;
  let retentionPolicyRepository: jest.Mocked<RetentionPolicyRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RetentionPolicyService,
        {
          provide: RetentionPolicyRepository,
          useValue: { getOrCreate: jest.fn(), update: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(RetentionPolicyService);
    retentionPolicyRepository = moduleRef.get(RetentionPolicyRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  it("getPolicy returns the workspace's policy, creating a default one if none exists", async () => {
    retentionPolicyRepository.getOrCreate.mockResolvedValue({
      auditLogRetentionDays: 365,
      loginHistoryRetentionDays: 365,
      notificationHistoryRetentionDays: 365,
      webhookDeliveryLogRetentionDays: 365,
    } as never);

    const result = await service.getPolicy("workspace-1");

    expect(result.auditLogRetentionDays).toBe(365);
  });

  it("updatePolicy persists the change and emits RETENTION_POLICY_UPDATED", async () => {
    retentionPolicyRepository.update.mockResolvedValue({
      auditLogRetentionDays: 90,
      loginHistoryRetentionDays: 365,
      notificationHistoryRetentionDays: 365,
      webhookDeliveryLogRetentionDays: 365,
    } as never);

    const result = await service.updatePolicy("workspace-1", "user-1", {
      auditLogRetentionDays: 90,
    });

    expect(retentionPolicyRepository.update).toHaveBeenCalledWith("workspace-1", {
      auditLogRetentionDays: 90,
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.RETENTION_POLICY_UPDATED,
      expect.objectContaining({ workspaceId: "workspace-1", actorId: "user-1" }),
    );
    expect(result.auditLogRetentionDays).toBe(90);
  });
});
