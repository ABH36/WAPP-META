import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PlanRepository } from "../repositories/plan.repository.js";
import { toPlanSummary } from "../mappers/billing.mapper.js";
import type { PlanSummary } from "../billing.types.js";

/**
 * PRD-005 Volume-1 §5. Seeds the three already-approved tiers on boot
 * (idempotent upsert, same "safe to re-run on every startup" shape as
 * ConversationAutoCloseProcessor's repeatable-job registration) — resolved
 * 2026-08-07: seed the approved names, leave pricing null until GTM
 * pricing is formally approved (TD-009, docs/TECH-DEBT.md).
 */
@Injectable()
export class PlanService implements OnModuleInit {
  private readonly logger = new Logger(PlanService.name);

  constructor(private readonly planRepository: PlanRepository) {}

  async onModuleInit(): Promise<void> {
    // TODO(GTM pricing): monthlyPrice/yearlyPrice stay null until the GTM
    // pricing decision is formally approved — see TD-009, docs/TECH-DEBT.md.
    await Promise.all([
      this.planRepository.upsertByName({ name: "Starter", description: null }),
      this.planRepository.upsertByName({ name: "Growth", description: null }),
      this.planRepository.upsertByName({ name: "Enterprise", description: null }),
    ]);
    this.logger.log("Plan catalog seeded (Starter/Growth/Enterprise)");
  }

  async listActive(): Promise<PlanSummary[]> {
    const plans = await this.planRepository.findAllActive();
    return plans.map(toPlanSummary);
  }
}
