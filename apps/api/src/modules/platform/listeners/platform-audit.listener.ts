import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  BreakGlassApprovedPayload,
  BreakGlassRequestedPayload,
  ComplianceReportExportedPayload,
  PlatformFeatureUpdatedPayload,
  PlatformMaintenanceDisabledPayload,
  PlatformMaintenanceEnabledPayload,
  PlatformPolicyUpdatedPayload,
  PlatformUserRoleChangedPayload,
  SupportSessionExpiredPayload,
  SupportSessionStartedPayload,
  SupportSessionTerminatedPayload,
} from "../../../common/events/domain-events.js";
import { PlatformAuditService } from "../services/platform-audit.service.js";

/**
 * §4.4/BR-002 — "Every Support Session generates immutable Audit entries."
 * One explicit @OnEvent handler per covered event, same convention as
 * every other audit listener in this codebase (BillingHistoryListener,
 * Settings' AuditLogListener) — see docs/ADR-PLAT-006-global-audit-center-strategy.md
 * for the full hybrid-model rationale (this listener covers only the
 * events with no other durable home; WORKSPACE_SUSPENDED/REACTIVATED/
 * ARCHIVED and Billing operator events are deliberately NOT duplicated
 * here — they're composed at read time from their existing owners).
 */
@Injectable()
export class PlatformAuditListener {
  constructor(private readonly platformAuditService: PlatformAuditService) {}

  @OnEvent(DomainEvent.BREAK_GLASS_REQUESTED)
  async onBreakGlassRequested(payload: BreakGlassRequestedPayload): Promise<void> {
    await this.record(
      payload,
      DomainEvent.BREAK_GLASS_REQUESTED,
      `Break-Glass Access Requested (${payload.reason})`,
    );
  }

  @OnEvent(DomainEvent.BREAK_GLASS_APPROVED)
  async onBreakGlassApproved(payload: BreakGlassApprovedPayload): Promise<void> {
    await this.record(payload, DomainEvent.BREAK_GLASS_APPROVED, "Break-Glass Access Approved");
  }

  @OnEvent(DomainEvent.SUPPORT_SESSION_STARTED)
  async onSupportSessionStarted(payload: SupportSessionStartedPayload): Promise<void> {
    await this.record(payload, DomainEvent.SUPPORT_SESSION_STARTED, "Support Session Started");
  }

  @OnEvent(DomainEvent.SUPPORT_SESSION_TERMINATED)
  async onSupportSessionTerminated(payload: SupportSessionTerminatedPayload): Promise<void> {
    await this.record(
      payload,
      DomainEvent.SUPPORT_SESSION_TERMINATED,
      `Support Session Ended (${payload.reason})`,
    );
  }

  @OnEvent(DomainEvent.SUPPORT_SESSION_EXPIRED)
  async onSupportSessionExpired(payload: SupportSessionExpiredPayload): Promise<void> {
    await this.record(payload, DomainEvent.SUPPORT_SESSION_EXPIRED, "Support Session Expired");
  }

  // The 3 previously-unaudited Volume-1 events — genuinely platform-wide,
  // no single workspaceId, closing a real gap that's existed since
  // Volume-1 (only the non-durable DomainEventLoggerListener ever saw
  // these before now).

  @OnEvent(DomainEvent.PLATFORM_FEATURE_UPDATED)
  async onPlatformFeatureUpdated(payload: PlatformFeatureUpdatedPayload): Promise<void> {
    await this.platformAuditService.record(
      DomainEvent.PLATFORM_FEATURE_UPDATED,
      `Platform Feature Flag "${payload.flagKey}" ${payload.enabled ? "Enabled" : "Disabled"}`,
      null,
      payload.actorId,
      payload as unknown as Record<string, unknown>,
      new Date(payload.occurredAt),
    );
  }

  @OnEvent(DomainEvent.PLATFORM_MAINTENANCE_ENABLED)
  async onPlatformMaintenanceEnabled(payload: PlatformMaintenanceEnabledPayload): Promise<void> {
    await this.platformAuditService.record(
      DomainEvent.PLATFORM_MAINTENANCE_ENABLED,
      "Platform Maintenance Enabled",
      null,
      payload.actorId,
      payload as unknown as Record<string, unknown>,
      new Date(payload.occurredAt),
    );
  }

  @OnEvent(DomainEvent.PLATFORM_MAINTENANCE_DISABLED)
  async onPlatformMaintenanceDisabled(payload: PlatformMaintenanceDisabledPayload): Promise<void> {
    await this.platformAuditService.record(
      DomainEvent.PLATFORM_MAINTENANCE_DISABLED,
      "Platform Maintenance Disabled",
      null,
      payload.actorId,
      payload as unknown as Record<string, unknown>,
      new Date(payload.occurredAt),
    );
  }

  // PRD-007 Volume-4 (Platform Analytics, Governance & Compliance, §8) —
  // also genuinely platform-wide, no workspaceId. BR-004 — "Every policy
  // change generates Platform Audit"; Q4's approved role-change capability
  // and the Compliance Export action are audited the same way.

  @OnEvent(DomainEvent.PLATFORM_POLICY_UPDATED)
  async onPlatformPolicyUpdated(payload: PlatformPolicyUpdatedPayload): Promise<void> {
    await this.platformAuditService.record(
      DomainEvent.PLATFORM_POLICY_UPDATED,
      `Governance Policy "${payload.policyKey}" updated to version ${payload.version} (${payload.reason})`,
      null,
      payload.actorId,
      payload as unknown as Record<string, unknown>,
      new Date(payload.occurredAt),
    );
  }

  @OnEvent(DomainEvent.PLATFORM_USER_ROLE_CHANGED)
  async onPlatformUserRoleChanged(payload: PlatformUserRoleChangedPayload): Promise<void> {
    await this.platformAuditService.record(
      DomainEvent.PLATFORM_USER_ROLE_CHANGED,
      `Platform User role changed from ${payload.previousRole} to ${payload.newRole}`,
      null,
      payload.actorId,
      payload as unknown as Record<string, unknown>,
      new Date(payload.occurredAt),
    );
  }

  @OnEvent(DomainEvent.COMPLIANCE_REPORT_EXPORTED)
  async onComplianceReportExported(payload: ComplianceReportExportedPayload): Promise<void> {
    await this.platformAuditService.record(
      DomainEvent.COMPLIANCE_REPORT_EXPORTED,
      `Compliance Report exported (${payload.format})`,
      null,
      payload.actorId,
      payload as unknown as Record<string, unknown>,
      new Date(payload.occurredAt),
    );
  }

  private async record(
    payload: { workspaceId: string; actorId: string; occurredAt: string },
    eventType: string,
    description: string,
  ): Promise<void> {
    await this.platformAuditService.record(
      eventType,
      description,
      payload.workspaceId,
      payload.actorId,
      payload,
      new Date(payload.occurredAt),
    );
  }
}
