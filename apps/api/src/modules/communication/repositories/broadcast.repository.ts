import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Broadcast, BroadcastDocument, BroadcastStatus } from "../schemas/broadcast.schema.js";

export interface CreateBroadcastInput {
  workspaceId: string;
  name: string;
  templateId: string;
  phoneNumberId: string;
  campaignId?: string | null;
  bodyParameters: string[];
  status: BroadcastStatus;
  scheduledAt: Date | null;
  createdBy: string;
}

/** Statuses a wave/Broadcast is done in — used to decide whether a Campaign still has active work outstanding. */
const TERMINAL_BROADCAST_STATUSES: BroadcastStatus[] = [
  BroadcastStatus.COMPLETED,
  BroadcastStatus.CANCELLED,
  BroadcastStatus.FAILED,
];

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

  async findByCampaign(workspaceId: string, campaignId: string): Promise<BroadcastDocument[]> {
    return this.broadcastModel.find({ workspaceId, campaignId }).sort({ scheduledAt: 1 }).exec();
  }

  /** Waves not yet in a terminal state — a Campaign is COMPLETED once this reaches zero. */
  async countActiveByCampaign(workspaceId: string, campaignId: string): Promise<number> {
    return this.broadcastModel
      .countDocuments({
        workspaceId,
        campaignId,
        status: { $nin: TERMINAL_BROADCAST_STATUSES },
      })
      .exec();
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
