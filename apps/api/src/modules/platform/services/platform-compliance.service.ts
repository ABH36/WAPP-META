import { Injectable } from "@nestjs/common";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { RetentionPolicyRepository } from "../../settings/repositories/retention-policy.repository.js";
import { ExportJobRepository } from "../../settings/repositories/export-job.repository.js";
import { SupportSessionRepository } from "../repositories/support-session.repository.js";
import { SupportSessionStatus } from "../schemas/support-session.schema.js";
import { PlatformLoginHistoryRepository } from "../repositories/platform-login-history.repository.js";
import { PlatformAuditRepository } from "../repositories/platform-audit.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { PlatformComplianceSnapshot } from "../platform.types.js";

/**
 * PRD-007 Volume-4 §4.4 — read-only composition over Volume-2/3/4's already
 * cross-tenant-capable repositories, plus two minimal Settings extensions
 * (Export Jobs, Data Retention Status). No new persistence — every field
 * is a live read. See docs/ADR-PLAT-008-platform-analytics-strategy.md.
 */
@Injectable()
export class PlatformComplianceService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly retentionPolicyRepository: RetentionPolicyRepository,
    private readonly exportJobRepository: ExportJobRepository,
    private readonly supportSessionRepository: SupportSessionRepository,
    private readonly loginHistoryRepository: PlatformLoginHistoryRepository,
    private readonly platformAuditRepository: PlatformAuditRepository,
  ) {}

  async getSnapshot(): Promise<PlatformComplianceSnapshot> {
    const [
      breakGlassTotal,
      breakGlassActive,
      loginTotal,
      loginFailed,
      permissionChangesResult,
      auditTotalResult,
      totalWorkspaces,
      retentionPolicies,
      exportJobsByStatus,
    ] = await Promise.all([
      this.supportSessionRepository.list({}, 1, 1),
      this.supportSessionRepository.list({ status: SupportSessionStatus.ACTIVE }, 1, 1),
      this.loginHistoryRepository.countAll(),
      this.loginHistoryRepository.countFailed(),
      this.platformAuditRepository.list(
        { eventType: DomainEvent.PLATFORM_USER_ROLE_CHANGED },
        1,
        1,
      ),
      this.platformAuditRepository.list({}, 1, 1),
      this.workspaceRepository.countAll(),
      this.retentionPolicyRepository.findAll(),
      this.exportJobRepository.countByStatusAcrossWorkspaces(),
    ]);

    return {
      breakGlassSessions: { total: breakGlassTotal.total, active: breakGlassActive.total },
      platformLogins: { total: loginTotal, successful: loginTotal - loginFailed },
      failedLoginAttempts: loginFailed,
      permissionChanges: permissionChangesResult.total,
      auditCoverage: auditTotalResult.total,
      dataRetentionStatus: { workspacesWithPolicy: retentionPolicies.length, totalWorkspaces },
      exportJobs: exportJobsByStatus,
    };
  }
}
