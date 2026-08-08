import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  ConfigHistoryArea,
  ConfigHistoryEntry,
  ConfigHistoryEntryDocument,
} from "../schemas/config-history-entry.schema.js";

export interface RecordConfigHistoryInput {
  workspaceId: string;
  area: ConfigHistoryArea;
  newValue: Record<string, unknown>;
  changedBy: string;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/** BR-003 — append-only. No update or delete method exists here by design. */
@Injectable()
export class ConfigHistoryRepository {
  constructor(
    @InjectModel(ConfigHistoryEntry.name)
    private readonly configHistoryModel: Model<ConfigHistoryEntryDocument>,
  ) {}

  async findLatestForArea(
    workspaceId: string,
    area: ConfigHistoryArea,
  ): Promise<ConfigHistoryEntryDocument | null> {
    return this.configHistoryModel.findOne({ workspaceId, area }).sort({ createdAt: -1 }).exec();
  }

  async record(input: RecordConfigHistoryInput): Promise<void> {
    const previous = await this.findLatestForArea(input.workspaceId, input.area);
    await this.configHistoryModel.create({
      workspaceId: input.workspaceId,
      area: input.area,
      previousValue: previous?.newValue ?? null,
      newValue: input.newValue,
      changedBy: input.changedBy,
    });
  }

  async findByWorkspace(
    workspaceId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ConfigHistoryEntryDocument[]; total: number }> {
    const boundedLimit = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
    const query = { workspaceId };

    const [items, total] = await Promise.all([
      this.configHistoryModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((Math.max(page, 1) - 1) * boundedLimit)
        .limit(boundedLimit)
        .exec(),
      this.configHistoryModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }
}
