import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { WorkspaceStatus } from "@wapp/shared-types";
import { Workspace, WorkspaceDocument } from "../schemas/workspace.schema.js";
import type { BusinessHoursDay, PublicHoliday } from "../schemas/workspace.schema.js";

export interface CreateWorkspaceInput {
  name: string;
  ownerId: string;
}

@Injectable()
export class WorkspaceRepository {
  constructor(
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<WorkspaceDocument>,
  ) {}

  async create(input: CreateWorkspaceInput): Promise<WorkspaceDocument> {
    return this.workspaceModel.create({
      name: input.name,
      ownerId: input.ownerId,
    });
  }

  async findById(id: string): Promise<WorkspaceDocument | null> {
    return this.workspaceModel.findOne({ _id: id, isDeleted: false }).exec();
  }

  async updateBusinessProfile(
    id: string,
    profile: Partial<{ category: string; description: string; gstin: string }>,
  ): Promise<void> {
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(profile)) {
      update[`businessProfile.${key}`] = value === "" ? null : value;
    }
    await this.workspaceModel.updateOne({ _id: id }, { $set: update }).exec();
  }

  async updateBusinessHours(
    id: string,
    hours: Partial<{
      timezone: string;
      schedule: BusinessHoursDay[];
      publicHolidays: PublicHoliday[];
    }>,
  ): Promise<void> {
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(hours)) {
      update[`businessHours.${key}`] = value;
    }
    await this.workspaceModel.updateOne({ _id: id }, { $set: update }).exec();
  }

  async updateNotificationSettings(
    id: string,
    settings: Partial<{
      taskFollowUpReminder: boolean;
      conversationLeadAssignment: boolean;
      broadcastCompleted: boolean;
      subscriptionReminder: boolean;
    }>,
  ): Promise<void> {
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(settings)) {
      update[`notificationSettings.${key}`] = value;
    }
    await this.workspaceModel.updateOne({ _id: id }, { $set: update }).exec();
  }

  async updateStatus(id: string, status: WorkspaceStatus): Promise<void> {
    await this.workspaceModel.updateOne({ _id: id }, { $set: { status } }).exec();
  }

  async updateOwner(id: string, ownerId: string): Promise<void> {
    await this.workspaceModel.updateOne({ _id: id }, { $set: { ownerId } }).exec();
  }
}
