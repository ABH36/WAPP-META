import { Injectable } from "@nestjs/common";
import {
  ListPlatformAuditFilter,
  PlatformAuditRepository,
} from "../repositories/platform-audit.repository.js";
import { toPlatformAuditEntrySummary } from "../mappers/platform.mapper.js";
import type { PlatformAuditEntrySummary } from "../platform.types.js";

const MAX_PAGE_SIZE = 100;

export interface ListPlatformAuditResult {
  items: PlatformAuditEntrySummary[];
  total: number;
}

/** §4.4 (Global Audit Center). Written only by PlatformAuditListener. */
@Injectable()
export class PlatformAuditService {
  constructor(private readonly platformAuditRepository: PlatformAuditRepository) {}

  async record(
    eventType: string,
    description: string,
    workspaceId: string | null,
    actorId: string | null,
    metadata: Record<string, unknown>,
    occurredAt: Date,
  ): Promise<void> {
    await this.platformAuditRepository.record({
      eventType,
      description,
      workspaceId,
      actorId,
      metadata,
      occurredAt,
    });
  }

  async list(
    filter: ListPlatformAuditFilter,
    page: number,
    limit: number,
  ): Promise<ListPlatformAuditResult> {
    const { items, total } = await this.platformAuditRepository.list(
      filter,
      page,
      Math.min(limit, MAX_PAGE_SIZE),
    );
    return { items: items.map(toPlatformAuditEntrySummary), total };
  }

  /** §4.5 — Investigation Timeline's platform-audit source. */
  async listRecentForWorkspace(
    workspaceId: string,
    limit: number,
  ): Promise<PlatformAuditEntrySummary[]> {
    const entries = await this.platformAuditRepository.findByWorkspace(workspaceId, limit);
    return entries.map(toPlatformAuditEntrySummary);
  }
}
