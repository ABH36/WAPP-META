import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { RetentionPolicyRepository } from "../repositories/retention-policy.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { RetentionPolicyUpdatedPayload } from "../../../common/events/domain-events.js";
import type { UpdateRetentionPolicyDto } from "../dto/update-retention-policy.dto.js";
import type { RetentionPolicyDocument } from "../schemas/retention-policy.schema.js";
import type { RetentionPolicySummary } from "../settings.types.js";

function toSummary(policy: RetentionPolicyDocument): RetentionPolicySummary {
  return {
    auditLogRetentionDays: policy.auditLogRetentionDays,
    loginHistoryRetentionDays: policy.loginHistoryRetentionDays,
    notificationHistoryRetentionDays: policy.notificationHistoryRetentionDays,
    webhookDeliveryLogRetentionDays: policy.webhookDeliveryLogRetentionDays,
  };
}

/** PRD-006 Volume-4 §4.4 — BR-007: config only, never immediate deletion. Actual cleanup runs on RetentionCleanupProcessor's own schedule. */
@Injectable()
export class RetentionPolicyService {
  constructor(
    private readonly retentionPolicyRepository: RetentionPolicyRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getPolicy(workspaceId: string): Promise<RetentionPolicySummary> {
    const policy = await this.retentionPolicyRepository.getOrCreate(workspaceId);
    return toSummary(policy);
  }

  async updatePolicy(
    workspaceId: string,
    actorId: string,
    dto: UpdateRetentionPolicyDto,
  ): Promise<RetentionPolicySummary> {
    const policy = await this.retentionPolicyRepository.update(workspaceId, dto);

    this.eventEmitter.emit(DomainEvent.RETENTION_POLICY_UPDATED, {
      workspaceId,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies RetentionPolicyUpdatedPayload);

    return toSummary(policy);
  }
}
