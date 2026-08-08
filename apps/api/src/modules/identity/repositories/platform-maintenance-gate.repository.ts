import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  PLATFORM_MAINTENANCE_GATE_SINGLETON_KEY,
  PlatformMaintenanceGate,
  PlatformMaintenanceGateDocument,
} from "../schemas/platform-maintenance-gate.schema.js";

@Injectable()
export class PlatformMaintenanceGateRepository {
  constructor(
    @InjectModel(PlatformMaintenanceGate.name)
    private readonly platformMaintenanceGateModel: Model<PlatformMaintenanceGateDocument>,
  ) {}

  async isEnabled(): Promise<boolean> {
    const state = await this.platformMaintenanceGateModel
      .findOne({ key: PLATFORM_MAINTENANCE_GATE_SINGLETON_KEY })
      .exec();
    return state?.enabled ?? false;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await this.platformMaintenanceGateModel
      .findOneAndUpdate(
        { key: PLATFORM_MAINTENANCE_GATE_SINGLETON_KEY },
        { $set: { enabled } },
        { upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}
