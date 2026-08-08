import { Injectable } from "@nestjs/common";
import { AuthService } from "../../identity/services/auth.service.js";
import type { LoginHistorySummary } from "../../identity/identity.types.js";
import { AuditLogRepository } from "../repositories/audit-log.repository.js";
import { AuditCategory, AuditResult } from "../schemas/audit-log-entry.schema.js";
import type { AuditLogEntryDocument } from "../schemas/audit-log-entry.schema.js";
import type { AuditLogEntrySummary, AuditLogPage } from "../settings.types.js";

function toAuditLogEntrySummary(entry: AuditLogEntryDocument): AuditLogEntrySummary {
  return {
    id: entry._id.toString(),
    category: entry.category,
    actorId: entry.actorId,
    module: entry.module,
    entity: entry.entity,
    entityId: entry.entityId,
    action: entry.action,
    result: entry.result,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    metadata: entry.metadata,
    createdAt: entry.createdAt.toISOString(),
  };
}

function toAuditLogEntryFromLoginHistory(entry: LoginHistorySummary): AuditLogEntrySummary {
  return {
    id: entry.id,
    category: AuditCategory.AUTHENTICATION,
    actorId: entry.userId,
    module: "Identity",
    entity: "LoginAttempt",
    entityId: null,
    action: entry.success ? "Login Succeeded" : "Login Failed",
    result: entry.success ? AuditResult.SUCCESS : AuditResult.FAILURE,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    metadata: entry.reason ? { reason: entry.reason } : null,
    createdAt: entry.createdAt,
  };
}

/**
 * PRD-006 Volume-4 §4.1 — read-only (BR-001/BR-002). AUTHENTICATION is
 * handled as its own branch: composed from Identity's `LoginHistoryEntry`
 * at read time rather than queried from `AuditLogEntry` (nothing is ever
 * written there for this category — see `AuditLogListener`'s doc comment).
 * Mixing the two sources into one paginated result would require merging
 * two different collections' sort orders; deliberately not attempted here
 * — a `category=AUTHENTICATION` filter returns Identity's (bounded,
 * recent-history) results, everything else paginates `AuditLogEntry`
 * normally. See docs/ADR-SET-007-audit-strategy.md.
 */
@Injectable()
export class AuditLogService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly authService: AuthService,
  ) {}

  async getAuditLogs(
    workspaceId: string,
    category: AuditCategory | undefined,
    page: number,
    limit: number,
  ): Promise<AuditLogPage> {
    if (category === AuditCategory.AUTHENTICATION) {
      const history = await this.authService.getWorkspaceLoginHistory(workspaceId);
      const items = history.map(toAuditLogEntryFromLoginHistory);
      return { items, total: items.length, page: 1, limit: items.length };
    }

    const { items, total } = await this.auditLogRepository.findByWorkspace(
      workspaceId,
      { category },
      page,
      limit,
    );
    return { items: items.map(toAuditLogEntrySummary), total, page, limit };
  }
}
