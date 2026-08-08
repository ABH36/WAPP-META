import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  AuditCategory,
  AuditLogEntry,
  AuditLogEntryDocument,
  AuditResult,
} from "../schemas/audit-log-entry.schema.js";

export interface RecordAuditLogInput {
  workspaceId: string;
  category: AuditCategory;
  actorId: string | null;
  module: string;
  entity: string | null;
  entityId: string | null;
  action: string;
  result?: AuditResult;
  metadata?: Record<string, unknown> | null;
}

export interface AuditLogFilter {
  category?: AuditCategory;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/** BR-001/BR-002 — immutable, insert-only. `deleteOlderThan` is the one sanctioned exception (§4.4 Data Retention), same posture as LoginHistoryRepository/WebhookDeliveryLogRepository. */
@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectModel(AuditLogEntry.name) private readonly auditLogModel: Model<AuditLogEntryDocument>,
  ) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    await this.auditLogModel.create({
      ...input,
      result: input.result ?? AuditResult.SUCCESS,
      metadata: input.metadata ?? null,
    });
  }

  async findByWorkspace(
    workspaceId: string,
    filter: AuditLogFilter,
    page: number,
    limit: number,
  ): Promise<{ items: AuditLogEntryDocument[]; total: number }> {
    const boundedLimit = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
    const query: Record<string, unknown> = { workspaceId };
    if (filter.category) {
      query.category = filter.category;
    }

    const [items, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((Math.max(page, 1) - 1) * boundedLimit)
        .limit(boundedLimit)
        .exec(),
      this.auditLogModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  async deleteOlderThan(workspaceId: string, cutoffDate: Date): Promise<number> {
    const result = await this.auditLogModel
      .deleteMany({ workspaceId, createdAt: { $lt: cutoffDate } })
      .exec();
    return result.deletedCount;
  }
}
