import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  WhatsAppConnection,
  WhatsAppConnectionDocument,
  WhatsAppConnectionStatus,
} from "../schemas/whatsapp-connection.schema.js";

export interface CreateConnectionInput {
  workspaceId: string;
  wabaId: string;
  businessName: string | null;
  accessTokenEncrypted: string;
  connectedBy: string;
}

@Injectable()
export class WhatsAppConnectionRepository {
  constructor(
    @InjectModel(WhatsAppConnection.name)
    private readonly connectionModel: Model<WhatsAppConnectionDocument>,
  ) {}

  async findByWorkspace(workspaceId: string): Promise<WhatsAppConnectionDocument | null> {
    return this.connectionModel.findOne({ workspaceId, isDeleted: false }).exec();
  }

  async findByWaba(wabaId: string): Promise<WhatsAppConnectionDocument | null> {
    return this.connectionModel.findOne({ wabaId, isDeleted: false }).exec();
  }

  async upsertForWorkspace(input: CreateConnectionInput): Promise<WhatsAppConnectionDocument> {
    const updated = await this.connectionModel
      .findOneAndUpdate(
        { workspaceId: input.workspaceId },
        {
          $set: {
            wabaId: input.wabaId,
            businessName: input.businessName,
            accessTokenEncrypted: input.accessTokenEncrypted,
            connectedBy: input.connectedBy,
            status: WhatsAppConnectionStatus.CONNECTED,
            isDeleted: false,
            lastError: null,
            lastErrorAt: null,
          },
        },
        { new: true, upsert: true },
      )
      .exec();
    return updated;
  }

  async recordError(workspaceId: string, message: string): Promise<void> {
    await this.connectionModel
      .updateOne(
        { workspaceId },
        {
          $set: {
            status: WhatsAppConnectionStatus.ERROR,
            lastError: message,
            lastErrorAt: new Date(),
          },
        },
      )
      .exec();
  }
}
