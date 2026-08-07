import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PlanLimits, PlanLimitsDocument } from "../schemas/plan-limits.schema.js";

export interface UpsertPlanLimitsInput {
  planId: string;
}

@Injectable()
export class PlanLimitsRepository {
  constructor(
    @InjectModel(PlanLimits.name)
    private readonly planLimitsModel: Model<PlanLimitsDocument>,
  ) {}

  async findByPlanId(planId: string): Promise<PlanLimitsDocument | null> {
    return this.planLimitsModel.findOne({ planId }).exec();
  }

  /** Idempotent — used by PlanLimitsService's boot-time seed, same shape as PlanRepository.upsertByName. Entitlements default true, limits default null (TD-014) via the schema itself. */
  async upsertByPlanId(input: UpsertPlanLimitsInput): Promise<PlanLimitsDocument> {
    return this.planLimitsModel
      .findOneAndUpdate(
        { planId: input.planId },
        { $setOnInsert: { planId: input.planId } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}
