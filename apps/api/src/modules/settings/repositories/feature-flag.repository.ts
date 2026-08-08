import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  FeatureFlagKey,
  FeatureFlagState,
  FeatureFlagStateDocument,
} from "../schemas/feature-flag-state.schema.js";

// §4.5 — every workspace implicitly starts with the core modules visible
// and beta/experimental surfaces hidden, until explicitly toggled.
const DEFAULT_ENABLED: Record<FeatureFlagKey, boolean> = {
  [FeatureFlagKey.CRM_MODULE]: true,
  [FeatureFlagKey.BILLING_MODULE]: true,
  [FeatureFlagKey.COMMUNICATION_MODULE]: true,
  [FeatureFlagKey.AI_ASSISTANT]: false,
  [FeatureFlagKey.BETA_FEATURES]: false,
};

@Injectable()
export class FeatureFlagRepository {
  constructor(
    @InjectModel(FeatureFlagState.name)
    private readonly featureFlagModel: Model<FeatureFlagStateDocument>,
  ) {}

  async findByWorkspace(workspaceId: string): Promise<FeatureFlagStateDocument[]> {
    return this.featureFlagModel.find({ workspaceId }).exec();
  }

  async setEnabled(
    workspaceId: string,
    flagKey: FeatureFlagKey,
    enabled: boolean,
  ): Promise<FeatureFlagStateDocument> {
    return this.featureFlagModel
      .findOneAndUpdate(
        { workspaceId, flagKey },
        { $set: { enabled } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  static defaultFor(flagKey: FeatureFlagKey): boolean {
    return DEFAULT_ENABLED[flagKey];
  }
}
