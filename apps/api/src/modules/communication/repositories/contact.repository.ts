import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Contact, ContactDocument } from "../schemas/contact.schema.js";

@Injectable()
export class ContactRepository {
  constructor(@InjectModel(Contact.name) private readonly contactModel: Model<ContactDocument>) {}

  /** BDC-013 dedup — one Contact per (workspaceId, phoneNumber); creates on first sight, otherwise just bumps lastSeenAt/profile name. */
  async findOrCreate(
    workspaceId: string,
    phoneNumber: string,
    waProfileName: string | null,
  ): Promise<ContactDocument> {
    const now = new Date();
    return this.contactModel
      .findOneAndUpdate(
        { workspaceId, phoneNumber },
        {
          $set: { lastSeenAt: now, ...(waProfileName ? { waProfileName } : {}) },
          $setOnInsert: { firstSeenAt: now },
        },
        { new: true, upsert: true },
      )
      .exec();
  }

  async findByIdForWorkspace(workspaceId: string, id: string): Promise<ContactDocument | null> {
    return this.contactModel.findOne({ _id: id, workspaceId, isDeleted: false }).exec();
  }

  /** Validates a Broadcast's target list — every id must belong to this workspace and not be soft-deleted. */
  async findByIdsForWorkspace(workspaceId: string, ids: string[]): Promise<ContactDocument[]> {
    return this.contactModel.find({ _id: { $in: ids }, workspaceId, isDeleted: false }).exec();
  }
}
