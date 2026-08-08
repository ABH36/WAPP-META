import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  WorkspaceMaintenanceState,
  WorkspaceMaintenanceStateDocument,
} from "../schemas/workspace-maintenance-state.schema.js";

@Injectable()
export class WorkspaceMaintenanceStateRepository {
  constructor(
    @InjectModel(WorkspaceMaintenanceState.name)
    private readonly maintenanceStateModel: Model<WorkspaceMaintenanceStateDocument>,
  ) {}

  async isMaintenanceMode(workspaceId: string): Promise<boolean> {
    const state = await this.maintenanceStateModel.findOne({ workspaceId }).exec();
    return state?.maintenanceMode ?? false;
  }

  async setMaintenanceMode(workspaceId: string, maintenanceMode: boolean): Promise<void> {
    await this.maintenanceStateModel
      .findOneAndUpdate(
        { workspaceId },
        { $set: { maintenanceMode } },
        { upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}
