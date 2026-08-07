import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Plan, PlanDocument } from "../schemas/plan.schema.js";

export interface UpsertPlanInput {
  name: string;
  description: string | null;
}

/** Platform-global — no workspaceId anywhere here, unlike every other repository in this codebase. */
@Injectable()
export class PlanRepository {
  constructor(@InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>) {}

  async findAllActive(): Promise<PlanDocument[]> {
    return this.planModel.find({ isActive: true }).exec();
  }

  async findById(id: string): Promise<PlanDocument | null> {
    return this.planModel.findOne({ _id: id }).exec();
  }

  async findByName(name: string): Promise<PlanDocument | null> {
    return this.planModel.findOne({ name }).exec();
  }

  /** Idempotent — used by PlanService's boot-time seed, same "safe to re-run" shape as BullMQ's own repeatable-job registration. */
  async upsertByName(input: UpsertPlanInput): Promise<PlanDocument> {
    return this.planModel
      .findOneAndUpdate(
        { name: input.name },
        { $setOnInsert: { name: input.name, description: input.description } },
        { new: true, upsert: true },
      )
      .exec();
  }
}
