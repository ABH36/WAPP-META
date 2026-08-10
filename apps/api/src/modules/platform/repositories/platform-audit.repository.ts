import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model } from "mongoose";
import {
  PlatformAuditEntry,
  PlatformAuditEntryDocument,
} from "../schemas/platform-audit-entry.schema.js";

export interface RecordPlatformAuditInput {
  eventType: string;
  description: string;
  workspaceId: string | null;
  actorId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: Date;
}

export interface ListPlatformAuditFilter {
  workspaceId?: string;
  eventType?: string;
}

export interface ListPlatformAuditResult {
  items: PlatformAuditEntryDocument[];
  total: number;
}

/** Insert-only — §4.4 "Immutable. Append only." No update/delete method exists here by design. */
@Injectable()
export class PlatformAuditRepository {
  constructor(
    @InjectModel(PlatformAuditEntry.name)
    private readonly platformAuditEntryModel: Model<PlatformAuditEntryDocument>,
  ) {}

  async record(input: RecordPlatformAuditInput): Promise<PlatformAuditEntryDocument> {
    return this.platformAuditEntryModel.create(input);
  }

  async list(
    filter: ListPlatformAuditFilter,
    page: number,
    limit: number,
  ): Promise<ListPlatformAuditResult> {
    const query: FilterQuery<PlatformAuditEntryDocument> = {};
    if (filter.workspaceId) {
      query.workspaceId = filter.workspaceId;
    }
    if (filter.eventType) {
      query.eventType = filter.eventType;
    }

    const [items, total] = await Promise.all([
      this.platformAuditEntryModel
        .find(query)
        .sort({ occurredAt: -1 })
        .skip((Math.max(page, 1) - 1) * limit)
        .limit(limit)
        .exec(),
      this.platformAuditEntryModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  /** PRD-007 Volume-3 §4.5 — Investigation Timeline's platform-audit source. */
  async findByWorkspace(workspaceId: string, limit: number): Promise<PlatformAuditEntryDocument[]> {
    return this.platformAuditEntryModel
      .find({ workspaceId })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .exec();
  }

  /** PRD-007 Volume-4 §4.5 (Platform KPIs, "Platform Availability") — chronological, so the caller can walk maintenance ENABLED/DISABLED pairs in order. */
  async findByEventTypesAscending(eventTypes: string[]): Promise<PlatformAuditEntryDocument[]> {
    return this.platformAuditEntryModel
      .find({ eventType: { $in: eventTypes } })
      .sort({ occurredAt: 1 })
      .exec();
  }
}
