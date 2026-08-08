import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { RetentionPolicy, RetentionPolicyDocument } from "../schemas/retention-policy.schema.js";

export interface UpdateRetentionPolicyInput {
  auditLogRetentionDays?: number;
  loginHistoryRetentionDays?: number;
  notificationHistoryRetentionDays?: number;
  webhookDeliveryLogRetentionDays?: number;
}

@Injectable()
export class RetentionPolicyRepository {
  constructor(
    @InjectModel(RetentionPolicy.name)
    private readonly retentionPolicyModel: Model<RetentionPolicyDocument>,
  ) {}

  async getOrCreate(workspaceId: string): Promise<RetentionPolicyDocument> {
    return this.retentionPolicyModel
      .findOneAndUpdate(
        { workspaceId },
        { $setOnInsert: { workspaceId } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async update(
    workspaceId: string,
    input: UpdateRetentionPolicyInput,
  ): Promise<RetentionPolicyDocument> {
    return this.retentionPolicyModel
      .findOneAndUpdate(
        { workspaceId },
        { $set: input },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async findAll(): Promise<RetentionPolicyDocument[]> {
    return this.retentionPolicyModel.find().exec();
  }
}
