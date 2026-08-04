import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuthToken, AuthTokenDocument, AuthTokenType } from "../schemas/auth-token.schema.js";

@Injectable()
export class AuthTokenRepository {
  constructor(
    @InjectModel(AuthToken.name) private readonly authTokenModel: Model<AuthTokenDocument>,
  ) {}

  async create(input: {
    userId: string;
    type: AuthTokenType;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<AuthTokenDocument> {
    return this.authTokenModel.create(input);
  }

  async findValidByHash(tokenHash: string, type: AuthTokenType): Promise<AuthTokenDocument | null> {
    return this.authTokenModel
      .findOne({ tokenHash, type, usedAt: null, expiresAt: { $gt: new Date() } })
      .exec();
  }

  async markUsed(id: string): Promise<void> {
    await this.authTokenModel.updateOne({ _id: id }, { $set: { usedAt: new Date() } }).exec();
  }

  /** Invalidates any still-pending tokens of this type before issuing a new one — at most one live token per purpose per user. */
  async invalidatePendingForUser(userId: string, type: AuthTokenType): Promise<void> {
    await this.authTokenModel
      .updateMany({ userId, type, usedAt: null }, { $set: { usedAt: new Date() } })
      .exec();
  }
}
