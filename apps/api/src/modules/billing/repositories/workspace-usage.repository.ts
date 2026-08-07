import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { UsageCounterType } from "@wapp/shared-types";
import { WorkspaceUsage, WorkspaceUsageDocument } from "../schemas/workspace-usage.schema.js";

/** The 6 counters that are actually wired (TD-013 defers Campaigns/Storage/API Requests) each have a count/threshold/locked field triplet on WorkspaceUsage. */
const TRACKED_COUNTER_FIELDS: Partial<
  Record<UsageCounterType, { count: string; lastThresholdNotified: string; locked: string }>
> = {
  [UsageCounterType.TEAM_MEMBERS]: {
    count: "teamMembersCount",
    lastThresholdNotified: "teamMembersLastThresholdNotified",
    locked: "teamMembersLocked",
  },
  [UsageCounterType.CUSTOMERS]: {
    count: "customersCount",
    lastThresholdNotified: "customersLastThresholdNotified",
    locked: "customersLocked",
  },
  [UsageCounterType.LEADS]: {
    count: "leadsCount",
    lastThresholdNotified: "leadsLastThresholdNotified",
    locked: "leadsLocked",
  },
  [UsageCounterType.DEALS]: {
    count: "dealsCount",
    lastThresholdNotified: "dealsLastThresholdNotified",
    locked: "dealsLocked",
  },
  [UsageCounterType.BROADCASTS]: {
    count: "broadcastsCount",
    lastThresholdNotified: "broadcastsLastThresholdNotified",
    locked: "broadcastsLocked",
  },
  [UsageCounterType.MESSAGES]: {
    count: "messagesCount",
    lastThresholdNotified: "messagesLastThresholdNotified",
    locked: "messagesLocked",
  },
};

export function trackedFieldsFor(counterType: UsageCounterType) {
  const fields = TRACKED_COUNTER_FIELDS[counterType];
  if (!fields) {
    throw new Error(`${counterType} is a deferred counter (TD-013) — has no tracked field mapping`);
  }
  return fields;
}

@Injectable()
export class WorkspaceUsageRepository {
  constructor(
    @InjectModel(WorkspaceUsage.name)
    private readonly workspaceUsageModel: Model<WorkspaceUsageDocument>,
  ) {}

  async findByWorkspace(workspaceId: string): Promise<WorkspaceUsageDocument | null> {
    return this.workspaceUsageModel.findOne({ workspaceId }).exec();
  }

  /** Idempotent get-or-create — every Workspace gets a usage document lazily, on first counted event, rather than reactively on WORKSPACE_CREATED (keeps this collection decoupled from Workspace's own lifecycle). */
  async getOrCreate(workspaceId: string): Promise<WorkspaceUsageDocument> {
    return this.workspaceUsageModel
      .findOneAndUpdate(
        { workspaceId },
        { $setOnInsert: { workspaceId } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  /** Monotonically increasing — see WorkspaceUsage's own doc comment for why this never decrements. */
  async incrementCounter(
    workspaceId: string,
    counterType: UsageCounterType,
  ): Promise<WorkspaceUsageDocument> {
    const { count } = trackedFieldsFor(counterType);
    return this.workspaceUsageModel
      .findOneAndUpdate(
        { workspaceId },
        { $inc: { [count]: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async setLastThresholdNotified(
    workspaceId: string,
    counterType: UsageCounterType,
    threshold: number,
  ): Promise<void> {
    const { lastThresholdNotified } = trackedFieldsFor(counterType);
    await this.workspaceUsageModel
      .updateOne({ workspaceId }, { $set: { [lastThresholdNotified]: threshold } })
      .exec();
  }

  async setLocked(
    workspaceId: string,
    counterType: UsageCounterType,
    locked: boolean,
  ): Promise<void> {
    const { locked: lockedField } = trackedFieldsFor(counterType);
    await this.workspaceUsageModel
      .updateOne({ workspaceId }, { $set: { [lockedField]: locked } })
      .exec();
  }
}
