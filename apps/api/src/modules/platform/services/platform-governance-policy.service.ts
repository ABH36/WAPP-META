import { BadRequestException, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { GovernancePolicyRepository } from "../repositories/governance-policy.repository.js";
import { GovernancePolicyKey } from "../schemas/governance-policy.schema.js";
import { toGovernancePolicySummary } from "../mappers/platform.mapper.js";
import {
  DomainEvent,
  type PlatformPolicyUpdatedPayload,
} from "../../../common/events/domain-events.js";
import type { UpdateGovernancePolicyDto } from "../dto/update-governance-policy.dto.js";
import type { GovernancePolicySummary } from "../platform.types.js";

const VALID_KEYS = new Set<string>(Object.values(GovernancePolicyKey));

/**
 * PRD-007 Volume-4 §4.3/§4.6 (merged) — Architecture Review, 2026-08-10:
 * "Governance Policies are configuration records only. They are versioned,
 * reason-required and fully audited. They are not wired into live Identity
 * JWT lifetime, Settings retention defaults or other frozen module
 * behaviour in this volume." This service stores and audits; it has no
 * dependency on Identity or Settings whatsoever — see
 * docs/ADR-PLAT-007-platform-governance-strategy.md and TD-024.
 */
@Injectable()
export class PlatformGovernancePolicyService {
  constructor(
    private readonly governancePolicyRepository: GovernancePolicyRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(): Promise<GovernancePolicySummary[]> {
    const policies = await this.governancePolicyRepository.list();
    return policies.map(toGovernancePolicySummary);
  }

  async update(
    key: string,
    dto: UpdateGovernancePolicyDto,
    actorId: string,
  ): Promise<GovernancePolicySummary> {
    if (!VALID_KEYS.has(key)) {
      throw new BadRequestException(`Unknown Governance Policy key: ${key}`);
    }
    const policyKey = key as GovernancePolicyKey;

    const updated = await this.governancePolicyRepository.upsertByKey(
      policyKey,
      dto.value,
      dto.reason,
      actorId,
    );

    const payload: PlatformPolicyUpdatedPayload = {
      policyKey,
      version: updated.version,
      reason: dto.reason,
      actorId,
      occurredAt: new Date().toISOString(),
    };
    this.eventEmitter.emit(DomainEvent.PLATFORM_POLICY_UPDATED, payload);

    return toGovernancePolicySummary(updated);
  }
}
