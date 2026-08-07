import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model } from "mongoose";
import {
  ActivityType,
  FollowUpType,
  ReminderType,
  TaskPriority,
  TaskStatus,
} from "@wapp/shared-types";
import { Activity, ActivityDocument } from "../schemas/activity.schema.js";

export interface CreateActivityInput {
  workspaceId: string;
  type: ActivityType;
  customerId: string | null;
  dealId: string | null;
  title: string | null;
  description: string | null;
  text: string | null;
  mentions: string[];
  dueDate: Date | null;
  priority: TaskPriority | null;
  status: TaskStatus | null;
  assignedUserId: string | null;
  followUpDate: Date | null;
  followUpType: FollowUpType | null;
  reminderDate: Date | null;
  reminderType: ReminderType | null;
  createdBy: string;
}

export interface UpdateActivityInput {
  title?: string | null;
  description?: string | null;
  text?: string | null;
  mentions?: string[];
  dueDate?: Date | null;
  priority?: TaskPriority | null;
  followUpDate?: Date | null;
  followUpType?: FollowUpType | null;
  reminderDate?: Date | null;
  reminderType?: ReminderType | null;
}

export interface ListActivitiesFilter {
  type?: ActivityType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedUserId?: string;
  customerId?: string;
  dealId?: string;
  dueFrom?: Date;
  dueTo?: Date;
  /** §12 — free-text search across Title/Description/Note text. Customer/Deal name and Assigned User name would need a cross-collection lookup — deferred, same TD-006-style reasoning as Customer's "Last Conversation" sort field (see docs/TECH-DEBT.md). */
  q?: string;
}

/** §14 — the sortable fields Volume-5 supports. */
export type ActivitySortField = "createdAt" | "updatedAt" | "dueDate" | "priority";

export interface ListActivitiesResult {
  items: ActivityDocument[];
  total: number;
}

const SORT_FIELD_MAP: Record<ActivitySortField, string> = {
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  dueDate: "dueDate",
  priority: "priority",
};

/**
 * PRD-004 Volume-5 — a single `activities` collection, type-discriminated
 * (docs/ADR-CRM-015-activity-timeline-strategy.md). No delete beyond the
 * soft `archive()` below (BR-006).
 */
@Injectable()
export class ActivityRepository {
  constructor(
    @InjectModel(Activity.name) private readonly activityModel: Model<ActivityDocument>,
  ) {}

  async create(input: CreateActivityInput): Promise<ActivityDocument> {
    return this.activityModel.create({
      ...input,
      followUpCompletedAt: null,
      archivedAt: null,
      updatedBy: input.createdBy,
    });
  }

  async findByIdForWorkspace(workspaceId: string, id: string): Promise<ActivityDocument | null> {
    return this.activityModel.findOne({ _id: id, workspaceId }).exec();
  }

  async list(
    workspaceId: string,
    filter: ListActivitiesFilter,
    sortBy: ActivitySortField,
    sortOrder: 1 | -1,
    page: number,
    limit: number,
  ): Promise<ListActivitiesResult> {
    const query: FilterQuery<ActivityDocument> = { workspaceId };
    if (filter.type) {
      query.type = filter.type;
    }
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.priority) {
      query.priority = filter.priority;
    }
    if (filter.assignedUserId) {
      query.assignedUserId = filter.assignedUserId;
    }
    if (filter.customerId) {
      query.customerId = filter.customerId;
    }
    if (filter.dealId) {
      query.dealId = filter.dealId;
    }
    if (filter.dueFrom || filter.dueTo) {
      query.dueDate = {
        ...(filter.dueFrom ? { $gte: filter.dueFrom } : {}),
        ...(filter.dueTo ? { $lte: filter.dueTo } : {}),
      };
    }
    if (filter.q) {
      const pattern = new RegExp(filter.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ title: pattern }, { description: pattern }, { text: pattern }];
    }

    const [items, total] = await Promise.all([
      this.activityModel
        .find(query)
        .sort({ [SORT_FIELD_MAP[sortBy]]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.activityModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  async update(
    workspaceId: string,
    id: string,
    input: UpdateActivityInput,
    updatedBy: string,
  ): Promise<ActivityDocument | null> {
    return this.activityModel
      .findOneAndUpdate({ _id: id, workspaceId }, { $set: { ...input, updatedBy } }, { new: true })
      .exec();
  }

  async updateAssignment(
    workspaceId: string,
    id: string,
    assignedUserId: string | null,
    updatedBy: string,
  ): Promise<ActivityDocument | null> {
    return this.activityModel
      .findOneAndUpdate(
        { _id: id, workspaceId },
        { $set: { assignedUserId, updatedBy } },
        { new: true },
      )
      .exec();
  }

  /** BR-004 — Task only. */
  async updateTaskStatus(
    workspaceId: string,
    id: string,
    status: TaskStatus,
    updatedBy: string,
  ): Promise<ActivityDocument | null> {
    return this.activityModel
      .findOneAndUpdate({ _id: id, workspaceId }, { $set: { status, updatedBy } }, { new: true })
      .exec();
  }

  /** BR-005 — Follow-up only, sets the binary followUpCompletedAt marker. */
  async completeFollowUp(
    workspaceId: string,
    id: string,
    updatedBy: string,
  ): Promise<ActivityDocument | null> {
    return this.activityModel
      .findOneAndUpdate(
        { _id: id, workspaceId },
        { $set: { followUpCompletedAt: new Date(), updatedBy } },
        { new: true },
      )
      .exec();
  }

  /** BR-006 — soft delete only. */
  async archive(
    workspaceId: string,
    id: string,
    updatedBy: string,
  ): Promise<ActivityDocument | null> {
    return this.activityModel
      .findOneAndUpdate(
        { _id: id, workspaceId },
        { $set: { archivedAt: new Date(), updatedBy } },
        { new: true },
      )
      .exec();
  }
}
