import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model } from "mongoose";
import type { WorkspaceStatus } from "@wapp/shared-types";
import { Workspace, WorkspaceDocument } from "../schemas/workspace.schema.js";
import type { BusinessHoursDay, PublicHoliday } from "../schemas/workspace.schema.js";

export interface CreateWorkspaceInput {
  name: string;
  ownerId: string;
}

/** PRD-007 Volume-1 §4.1 — Workspace Registry filters. */
export interface ListWorkspacesForPlatformFilter {
  status?: WorkspaceStatus;
  /** Free-text search across Workspace Name only (§4.1 doesn't ask for Owner-name search, and Owner lives in a separate collection Platform Administration doesn't own). */
  q?: string;
}

export interface ListWorkspacesForPlatformResult {
  items: WorkspaceDocument[];
  total: number;
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

  /**
   * PRD-007 Volume-1 §4.1 — the first cross-tenant list/search read path in
   * this codebase (no `workspaceId` scope, deliberately). `q` matches only
   * the same fields a platform admin can actually see in the Registry
   * (Name) — Owner is a separate collection this repository has no join
   * into.
   */
  async listAllForPlatform(
    filter: ListWorkspacesForPlatformFilter,
    page: number,
    limit: number,
  ): Promise<ListWorkspacesForPlatformResult> {
    const query: FilterQuery<WorkspaceDocument> = { isDeleted: false };
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.q) {
      const pattern = new RegExp(filter.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.name = pattern;
    }

    const [items, total] = await Promise.all([
      this.workspaceModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((Math.max(page, 1) - 1) * limit)
        .limit(limit)
        .exec(),
      this.workspaceModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  /** PRD-007 Volume-1 §4.2 — Platform Dashboard's total-workspace-count tile. */
  async countAll(): Promise<number> {
    return this.workspaceModel.countDocuments({ isDeleted: false }).exec();
  }

  /** PRD-007 Volume-1 §4.2 — Platform Dashboard's status-breakdown tile. */
  async countByStatus(status: WorkspaceStatus): Promise<number> {
    return this.workspaceModel.countDocuments({ isDeleted: false, status }).exec();
  }

  /** PRD-007 Volume-1 §4.1/§10 — Suspend/Reactivate/Archive, always attributed to the acting PlatformUser (reason required for Suspend/Archive, null for Reactivate). */
  async updateStatusWithReason(
    id: string,
    status: WorkspaceStatus,
    reason: string | null,
    actorId: string,
  ): Promise<WorkspaceDocument | null> {
    return this.workspaceModel
      .findOneAndUpdate(
        { _id: id, isDeleted: false },
        {
          $set: {
            status,
            statusReason: reason,
            statusChangedAt: new Date(),
            statusChangedBy: actorId,
          },
        },
        { new: true },
      )
      .exec();
  }
}
