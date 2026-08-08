import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  ThirdPartyAppKey,
  ThirdPartyAppState,
  ThirdPartyAppStateDocument,
} from "../schemas/third-party-app.schema.js";

@Injectable()
export class ThirdPartyAppRepository {
  constructor(
    @InjectModel(ThirdPartyAppState.name)
    private readonly thirdPartyAppModel: Model<ThirdPartyAppStateDocument>,
  ) {}

  async findByWorkspace(workspaceId: string): Promise<ThirdPartyAppStateDocument[]> {
    return this.thirdPartyAppModel.find({ workspaceId }).exec();
  }

  async setEnabled(
    workspaceId: string,
    appKey: ThirdPartyAppKey,
    enabled: boolean,
  ): Promise<ThirdPartyAppStateDocument> {
    return this.thirdPartyAppModel
      .findOneAndUpdate(
        { workspaceId, appKey },
        { $set: { enabled } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}
