import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PhoneNumber, PhoneNumberDocument } from "../schemas/phone-number.schema.js";
import type { MetaPhoneNumberDetails } from "../services/meta-api-client.service.js";

@Injectable()
export class PhoneNumberRepository {
  constructor(
    @InjectModel(PhoneNumber.name) private readonly phoneNumberModel: Model<PhoneNumberDocument>,
  ) {}

  async upsert(
    workspaceId: string,
    whatsappConnectionId: string,
    phoneNumberId: string,
    details: MetaPhoneNumberDetails,
  ): Promise<PhoneNumberDocument> {
    return this.phoneNumberModel
      .findOneAndUpdate(
        { phoneNumberId },
        {
          $set: {
            workspaceId,
            whatsappConnectionId,
            displayPhoneNumber: details.displayPhoneNumber,
            verifiedName: details.verifiedName,
            qualityRating: details.qualityRating,
            messagingLimitTier: details.messagingLimitTier,
            lastSyncedAt: new Date(),
            isDeleted: false,
          },
        },
        { new: true, upsert: true },
      )
      .exec();
  }

  async findByWorkspace(workspaceId: string): Promise<PhoneNumberDocument[]> {
    return this.phoneNumberModel.find({ workspaceId, isDeleted: false }).exec();
  }

  async findByPhoneNumberId(phoneNumberId: string): Promise<PhoneNumberDocument | null> {
    return this.phoneNumberModel.findOne({ phoneNumberId, isDeleted: false }).exec();
  }

  async findByIdForWorkspace(workspaceId: string, id: string): Promise<PhoneNumberDocument | null> {
    return this.phoneNumberModel.findOne({ _id: id, workspaceId, isDeleted: false }).exec();
  }
}
