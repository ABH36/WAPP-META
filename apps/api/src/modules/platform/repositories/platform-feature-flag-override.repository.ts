import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { FeatureFlagKey } from "../../settings/schemas/feature-flag-state.schema.js";
import {
  PlatformFeatureFlagOverride,
  PlatformFeatureFlagOverrideDocument,
} from "../schemas/platform-feature-flag-override.schema.js";

@Injectable()
export class PlatformFeatureFlagOverrideRepository {
  constructor(
    @InjectModel(PlatformFeatureFlagOverride.name)
    private readonly platformFeatureFlagOverrideModel: Model<PlatformFeatureFlagOverrideDocument>,
  ) {}

  async findAll(): Promise<PlatformFeatureFlagOverrideDocument[]> {
    return this.platformFeatureFlagOverrideModel.find().exec();
  }

  async setEnabled(
    flagKey: FeatureFlagKey,
    enabled: boolean,
    updatedBy: string,
  ): Promise<PlatformFeatureFlagOverrideDocument> {
    return this.platformFeatureFlagOverrideModel
      .findOneAndUpdate(
        { flagKey },
        { $set: { enabled, updatedBy } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}
