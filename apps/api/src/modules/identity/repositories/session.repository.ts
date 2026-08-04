import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Session, SessionDocument } from "../schemas/session.schema.js";

@Injectable()
export class SessionRepository {
  constructor(@InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>) {}

  async create(input: {
    userId: string;
    jti: string;
    tokenHash: string;
    userAgent: string | null;
    ipAddress: string | null;
    expiresAt: Date;
  }): Promise<SessionDocument> {
    return this.sessionModel.create(input);
  }

  async findByJti(jti: string): Promise<SessionDocument | null> {
    return this.sessionModel.findOne({ jti }).exec();
  }

  async findActiveByUser(userId: string): Promise<SessionDocument[]> {
    return this.sessionModel
      .find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .exec();
  }

  async revokeByJti(jti: string, replacedByJti: string | null = null): Promise<void> {
    await this.sessionModel
      .updateOne({ jti }, { $set: { revokedAt: new Date(), replacedByJti } })
      .exec();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.sessionModel
      .updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();
  }

  /** Revoke a single session by its Mongo _id, scoped to the owning user (never trust a bare id from the client). */
  async revokeByIdForUser(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.sessionModel
      .updateOne({ _id: sessionId, userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();
    return result.modifiedCount > 0;
  }
}
