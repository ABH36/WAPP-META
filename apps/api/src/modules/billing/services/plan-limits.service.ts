import { Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { PlanLimitsRepository } from "../repositories/plan-limits.repository.js";
import { PlanRepository } from "../repositories/plan.repository.js";
// Constructor-injected only to force NestJS to instantiate PlanService (and
// run its own onModuleInit seed) before this service's onModuleInit runs —
// findByName below needs the Plan documents PlanService seeds to already
// exist. NestJS calls onModuleInit hooks in provider-instantiation order,
// which follows constructor dependencies.
import { PlanService } from "./plan.service.js";
import { toPlanLimitsSummary } from "../mappers/billing.mapper.js";
import type { PlanLimitsSummary } from "../billing.types.js";

const SEEDED_PLAN_NAMES = ["Starter", "Growth", "Enterprise"] as const;

/**
 * PRD-005 Volume-3 §5/§6. Seeds one PlanLimits document per already-seeded
 * Plan, idempotently, same "safe to re-run on every boot" shape as
 * PlanService itself. Entitlements default true (schema-level default,
 * matching Plan's "same full feature set in Phase-1" fact); numeric limits
 * default null (TD-014 — not yet approved commercial values, same
 * discipline as Plan.monthlyPrice).
 */
@Injectable()
export class PlanLimitsService implements OnModuleInit {
  private readonly logger = new Logger(PlanLimitsService.name);

  constructor(
    private readonly planLimitsRepository: PlanLimitsRepository,
    private readonly planRepository: PlanRepository,
    private readonly planService: PlanService,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const name of SEEDED_PLAN_NAMES) {
      const plan = await this.planRepository.findByName(name);
      if (!plan) {
        this.logger.warn(`Plan "${name}" not found — skipping PlanLimits seed for it`);
        continue;
      }
      await this.planLimitsRepository.upsertByPlanId({ planId: plan._id.toString() });
    }
    this.logger.log("PlanLimits seeded for Starter/Growth/Enterprise");
  }

  async getForPlan(planId: string): Promise<PlanLimitsSummary> {
    const planLimits = await this.planLimitsRepository.findByPlanId(planId);
    if (!planLimits) {
      throw new NotFoundException("PlanLimits not found for this Plan");
    }
    return toPlanLimitsSummary(planLimits);
  }
}
