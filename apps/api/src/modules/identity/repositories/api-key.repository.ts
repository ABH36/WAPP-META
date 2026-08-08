import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ApiKey, ApiKeyDocument, ApiKeyScope, ApiKeyStatus } from "../schemas/api-key.schema.js";

export interface CreateApiKeyInput {
  workspaceId: string;
  name: string;
  prefix: string;
  keyHash: string;
  scope: ApiKeyScope;
  createdBy: string;
  expiresAt: Date | null;
}

@Injectable()
export class ApiKeyRepository {
  constructor(@InjectModel(ApiKey.name) private readonly apiKeyModel: Model<ApiKeyDocument>) {}

  async create(input: CreateApiKeyInput): Promise<ApiKeyDocument> {
    return this.apiKeyModel.create(input);
  }

  async findByWorkspace(workspaceId: string): Promise<ApiKeyDocument[]> {
    return this.apiKeyModel.find({ workspaceId }).sort({ createdAt: -1 }).exec();
  }

  async findActiveByIdForWorkspace(
    workspaceId: string,
    id: string,
  ): Promise<ApiKeyDocument | null> {
    return this.apiKeyModel.findOne({ _id: id, workspaceId, status: ApiKeyStatus.ACTIVE }).exec();
  }

  // Validation lookup — prefix isn't guaranteed unique, so every ACTIVE
  // match is bcrypt-compared by the caller; keyHash is `select: false`
  // everywhere else and only pulled in here, for that comparison.
  async findActiveByPrefix(prefix: string): Promise<ApiKeyDocument[]> {
    return this.apiKeyModel.find({ prefix, status: ApiKeyStatus.ACTIVE }).select("+keyHash").exec();
  }

  async markUsed(id: string): Promise<void> {
    await this.apiKeyModel.updateOne({ _id: id }, { $set: { lastUsedAt: new Date() } }).exec();
  }

  // BR-008 — revoked keys cannot be restored; deliberately no reactivate
  // method anywhere in this repository.
  async revoke(workspaceId: string, id: string): Promise<ApiKeyDocument | null> {
    return this.apiKeyModel
      .findOneAndUpdate(
        { _id: id, workspaceId, status: ApiKeyStatus.ACTIVE },
        { $set: { status: ApiKeyStatus.REVOKED, revokedAt: new Date() } },
        { new: true },
      )
      .exec();
  }
}
