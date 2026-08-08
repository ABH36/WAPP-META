import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  PLATFORM_MAINTENANCE_STATE_SINGLETON_KEY,
  PlatformMaintenanceState,
  PlatformMaintenanceStateDocument,
} from "../schemas/platform-maintenance-state.schema.js";

@Injectable()
export class PlatformMaintenanceStateRepository {
  constructor(
    @InjectModel(PlatformMaintenanceState.name)
    private readonly platformMaintenanceStateModel: Model<PlatformMaintenanceStateDocument>,
  ) {}

  async get(): Promise<PlatformMaintenanceStateDocument | null> {
    return this.platformMaintenanceStateModel
      .findOne({ key: PLATFORM_MAINTENANCE_STATE_SINGLETON_KEY })
      .exec();
  }

  async setEnabled(
    enabled: boolean,
    reason: string | null,
    updatedBy: string,
  ): Promise<PlatformMaintenanceStateDocument> {
    return this.platformMaintenanceStateModel
      .findOneAndUpdate(
        { key: PLATFORM_MAINTENANCE_STATE_SINGLETON_KEY },
        { $set: { enabled, reason, updatedBy } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}
