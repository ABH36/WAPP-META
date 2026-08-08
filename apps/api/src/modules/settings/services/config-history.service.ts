import { Injectable } from "@nestjs/common";
import { ConfigHistoryRepository } from "../repositories/config-history.repository.js";
import type { ConfigHistoryEntryDocument } from "../schemas/config-history-entry.schema.js";
import type { ConfigHistoryEntrySummary } from "../settings.types.js";

function toConfigHistoryEntrySummary(entry: ConfigHistoryEntryDocument): ConfigHistoryEntrySummary {
  return {
    id: entry._id.toString(),
    area: entry.area,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
    changedBy: entry.changedBy,
    createdAt: entry.createdAt.toISOString(),
  };
}

/** PRD-006 Volume-4 §4.2 — read-only. */
@Injectable()
export class ConfigHistoryService {
  constructor(private readonly configHistoryRepository: ConfigHistoryRepository) {}

  async getHistory(
    workspaceId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ConfigHistoryEntrySummary[]; total: number; page: number; limit: number }> {
    const { items, total } = await this.configHistoryRepository.findByWorkspace(
      workspaceId,
      page,
      limit,
    );
    return { items: items.map(toConfigHistoryEntrySummary), total, page, limit };
  }
}
