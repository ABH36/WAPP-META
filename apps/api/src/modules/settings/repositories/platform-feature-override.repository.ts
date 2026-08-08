import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { FeatureFlagKey } from "../schemas/feature-flag-state.schema.js";
import {
  PlatformFeatureOverrideState,
  PlatformFeatureOverrideStateDocument,
} from "../schemas/platform-feature-override-state.schema.js";

@Injectable()
export class PlatformFeatureOverrideRepository {
  constructor(
    @InjectModel(PlatformFeatureOverrideState.name)
    private readonly platformFeatureOverrideStateModel: Model<PlatformFeatureOverrideStateDocument>,
  ) {}

  async findAll(): Promise<PlatformFeatureOverrideStateDocument[]> {
    return this.platformFeatureOverrideStateModel.find().exec();
  }

  async upsert(flagKey: FeatureFlagKey, enabled: boolean): Promise<void> {
    await this.platformFeatureOverrideStateModel
      .findOneAndUpdate(
        { flagKey },
        { $set: { enabled } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}
