import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  AnnouncementTargetType,
  PlatformAnnouncement,
  PlatformAnnouncementDocument,
} from "../schemas/platform-announcement.schema.js";

export interface CreatePlatformAnnouncementInput {
  title: string;
  message: string;
  targetType: AnnouncementTargetType;
  targetPlanIds: string[];
  targetWorkspaceIds: string[];
  createdBy: string;
}

@Injectable()
export class PlatformAnnouncementRepository {
  constructor(
    @InjectModel(PlatformAnnouncement.name)
    private readonly platformAnnouncementModel: Model<PlatformAnnouncementDocument>,
  ) {}

  async create(input: CreatePlatformAnnouncementInput): Promise<PlatformAnnouncementDocument> {
    return this.platformAnnouncementModel.create(input);
  }

  async findAll(): Promise<PlatformAnnouncementDocument[]> {
    return this.platformAnnouncementModel.find().sort({ createdAt: -1 }).exec();
  }
}
