import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PlatformSession, PlatformSessionDocument } from "../schemas/platform-session.schema.js";

export interface CreatePlatformSessionInput {
  platformUserId: string;
  jti: string;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
}

@Injectable()
export class PlatformSessionRepository {
  constructor(
    @InjectModel(PlatformSession.name)
    private readonly sessionModel: Model<PlatformSessionDocument>,
  ) {}

  async create(input: CreatePlatformSessionInput): Promise<PlatformSessionDocument> {
    return this.sessionModel.create(input);
  }

  async findByJti(jti: string): Promise<PlatformSessionDocument | null> {
    return this.sessionModel.findOne({ jti }).exec();
  }

  async revokeByJti(jti: string, replacedByJti: string | null = null): Promise<void> {
    await this.sessionModel
      .updateOne({ jti }, { $set: { revokedAt: new Date(), replacedByJti } })
      .exec();
  }

  async revokeAllForUser(platformUserId: string): Promise<void> {
    await this.sessionModel
      .updateMany({ platformUserId, revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();
  }
}
