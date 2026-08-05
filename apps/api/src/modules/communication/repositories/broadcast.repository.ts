import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Broadcast, BroadcastDocument, BroadcastStatus } from "../schemas/broadcast.schema.js";

export interface CreateBroadcastInput {
  workspaceId: string;
  name: string;
  templateId: string;
  phoneNumberId: string;
  bodyParameters: string[];
  status: BroadcastStatus;
  scheduledAt: Date | null;
  createdBy: string;
}

@Injectable()
export class BroadcastRepository {
  constructor(
    @InjectModel(Broadcast.name) private readonly broadcastModel: Model<BroadcastDocument>,
  ) {}

  async create(input: CreateBroadcastInput): Promise<BroadcastDocument> {
    return this.broadcastModel.create(input);
  }

  async findByIdForWorkspace(workspaceId: string, id: string): Promise<BroadcastDocument | null> {
    return this.broadcastModel.findOne({ _id: id, workspaceId }).exec();
  }

  async findByWorkspace(workspaceId: string): Promise<BroadcastDocument[]> {
    return this.broadcastModel.find({ workspaceId }).sort({ createdAt: -1 }).exec();
  }

  async updateStatus(
    id: string,
    status: BroadcastStatus,
    extra: Partial<{
      startedAt: Date | null;
      completedAt: Date | null;
      failureReason: string | null;
    }> = {},
  ): Promise<BroadcastDocument | null> {
    return this.broadcastModel
      .findOneAndUpdate({ _id: id }, { $set: { status, ...extra } }, { new: true })
      .exec();
  }
}
