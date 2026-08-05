import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Campaign, CampaignDocument, CampaignStatus } from "../schemas/campaign.schema.js";

export interface CreateCampaignInput {
  workspaceId: string;
  name: string;
  phoneNumberId: string;
  targetContactIds: string[];
  createdBy: string;
}

@Injectable()
export class CampaignRepository {
  constructor(
    @InjectModel(Campaign.name) private readonly campaignModel: Model<CampaignDocument>,
  ) {}

  async create(input: CreateCampaignInput): Promise<CampaignDocument> {
    return this.campaignModel.create({ ...input, status: CampaignStatus.ACTIVE });
  }

  async findByIdForWorkspace(workspaceId: string, id: string): Promise<CampaignDocument | null> {
    return this.campaignModel.findOne({ _id: id, workspaceId }).exec();
  }

  async findByWorkspace(workspaceId: string): Promise<CampaignDocument[]> {
    return this.campaignModel.find({ workspaceId }).sort({ createdAt: -1 }).exec();
  }

  async updateStatus(
    id: string,
    status: CampaignStatus,
    extra: Partial<{ completedAt: Date | null }> = {},
  ): Promise<CampaignDocument | null> {
    return this.campaignModel
      .findOneAndUpdate({ _id: id }, { $set: { status, ...extra } }, { new: true })
      .exec();
  }
}
