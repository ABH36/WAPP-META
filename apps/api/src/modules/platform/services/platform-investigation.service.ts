import { Injectable } from "@nestjs/common";
import { PlatformAuditService } from "./platform-audit.service.js";
import { AuditLogService } from "../../settings/services/audit-log.service.js";
import { BillingHistoryService } from "../../billing/services/billing-history.service.js";
import { AuthService } from "../../identity/services/auth.service.js";
import type { InvestigationTimelineEntry } from "../platform.types.js";

const DEFAULT_SOURCE_LIMIT = 25;

/**
 * PRD-007 Volume-3 §4.5 — "Unified timeline... combines Audit + Billing
 * History + Login History + Platform Actions... Read-only." A normalized
 * projection over 4 already-existing sources; owns none of the underlying
 * data (§11). Mandatory `workspaceId` (unlike Global Audit Center, which
 * can browse unscoped) — Investigation only ever runs inside an active
 * Support Session for one specific workspace, per "Support Sessions become
 * the temporary authorization boundary for cross-tenant investigation"
 * (Architecture Review, 2026-08-10); the caller must already have passed
 * `SupportSessionGuard`. Merges each source's own most-recent page and
 * sorts client-side — true cross-source cursor pagination is deferred
 * (acceptable for now, same posture as TD-020 — revisit once real usage
 * data exists). See docs/ADR-PLAT-006-global-audit-center-strategy.md.
 */
@Injectable()
export class PlatformInvestigationService {
  constructor(
    private readonly platformAuditService: PlatformAuditService,
    private readonly auditLogService: AuditLogService,
    private readonly billingHistoryService: BillingHistoryService,
    private readonly authService: AuthService,
  ) {}

  async getTimeline(workspaceId: string, limit: number): Promise<InvestigationTimelineEntry[]> {
    const sourceLimit = limit || DEFAULT_SOURCE_LIMIT;

    const [platformAudit, settingsAudit, billingHistory, loginHistory] = await Promise.all([
      this.platformAuditService.listRecentForWorkspace(workspaceId, sourceLimit),
      this.auditLogService.getAuditLogs(workspaceId, undefined, 1, sourceLimit),
      this.billingHistoryService.listRecentForWorkspace(workspaceId, sourceLimit),
      this.authService.getWorkspaceLoginHistory(workspaceId),
    ]);

    const entries: InvestigationTimelineEntry[] = [
      ...platformAudit.map((entry): InvestigationTimelineEntry => ({
        source: "PLATFORM_AUDIT",
        id: entry.id,
        workspaceId,
        eventType: entry.eventType,
        description: entry.description,
        occurredAt: entry.occurredAt,
      })),
      ...settingsAudit.items.map((entry): InvestigationTimelineEntry => ({
        source: "SETTINGS_AUDIT",
        id: entry.id,
        workspaceId,
        eventType: entry.category,
        description: entry.action,
        occurredAt: entry.createdAt,
      })),
      ...billingHistory.map((entry): InvestigationTimelineEntry => ({
        source: "BILLING_HISTORY",
        id: entry.id,
        workspaceId,
        eventType: entry.eventType,
        description: entry.description,
        occurredAt: entry.occurredAt,
      })),
      ...loginHistory.map((entry): InvestigationTimelineEntry => ({
        source: "LOGIN_HISTORY",
        id: entry.id,
        workspaceId,
        eventType: entry.success ? "login.success" : "login.failed",
        description: entry.success
          ? "Login Succeeded"
          : `Login Failed (${entry.reason ?? "unknown"})`,
        occurredAt: entry.createdAt,
      })),
    ];

    entries.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    return entries.slice(0, sourceLimit);
  }
}
