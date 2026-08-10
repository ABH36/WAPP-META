import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  GovernancePolicy,
  GovernancePolicyDocument,
  GovernancePolicyKey,
} from "../schemas/governance-policy.schema.js";

@Injectable()
export class GovernancePolicyRepository {
  constructor(
    @InjectModel(GovernancePolicy.name)
    private readonly governancePolicyModel: Model<GovernancePolicyDocument>,
  ) {}

  async findByKey(key: GovernancePolicyKey): Promise<GovernancePolicyDocument | null> {
    return this.governancePolicyModel.findOne({ key }).exec();
  }

  async list(): Promise<GovernancePolicyDocument[]> {
    return this.governancePolicyModel.find().sort({ key: 1 }).exec();
  }

  /**
   * Upsert-by-key, mirroring `PlatformFeatureFlagOverrideRepository.setEnabled`'s
   * precedent — first PATCH for a key creates it (version 1); every
   * subsequent PATCH pushes the document's current {value, version, reason,
   * updatedBy, updatedAt} onto `history` before applying the new value and
   * incrementing `version`.
   */
  async upsertByKey(
    key: GovernancePolicyKey,
    value: Record<string, unknown>,
    reason: string,
    updatedBy: string,
  ): Promise<GovernancePolicyDocument> {
    const existing = await this.governancePolicyModel.findOne({ key }).exec();

    if (!existing) {
      return this.governancePolicyModel.create({
        key,
        value,
        version: 1,
        reason,
        updatedBy,
        history: [],
      });
    }

    const historyEntry = {
      value: existing.value,
      version: existing.version,
      reason: existing.reason,
      updatedBy: existing.updatedBy,
      updatedAt: existing.updatedAt,
    };

    const updated = await this.governancePolicyModel
      .findOneAndUpdate(
        { key },
        {
          $set: { value, reason, updatedBy },
          $inc: { version: 1 },
          $push: { history: historyEntry },
        },
        { new: true },
      )
      .exec();
    // existing was just found by the same key, so this cannot be null.
    return updated!;
  }
}
