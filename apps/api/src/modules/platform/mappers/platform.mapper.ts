import type { WorkspaceDocument } from "../../workspace/schemas/workspace.schema.js";
import type { UserDocument } from "../../identity/schemas/user.schema.js";
import type { PlatformAnnouncementDocument } from "../schemas/platform-announcement.schema.js";
import type { SupportTicketDocument } from "../schemas/support-ticket.schema.js";
import type { SupportSessionDocument } from "../schemas/support-session.schema.js";
import type { PlatformAuditEntryDocument } from "../schemas/platform-audit-entry.schema.js";
import type { GovernancePolicyDocument } from "../schemas/governance-policy.schema.js";
import type {
  GovernancePolicySummary,
  PlatformAnnouncementSummary,
  PlatformAuditEntrySummary,
  PlatformSearchUserSummary,
  PlatformWorkspaceSummary,
  SupportSessionSummary,
  SupportTicketSummary,
} from "../platform.types.js";

export function toPlatformWorkspaceSummary(workspace: WorkspaceDocument): PlatformWorkspaceSummary {
  return {
    id: workspace._id.toString(),
    name: workspace.name,
    ownerId: workspace.ownerId.toString(),
    status: workspace.status,
    statusReason: workspace.statusReason,
    statusChangedAt: workspace.statusChangedAt ? workspace.statusChangedAt.toISOString() : null,
    statusChangedBy: workspace.statusChangedBy,
    createdAt: workspace.createdAt.toISOString(),
  };
}

export function toPlatformAnnouncementSummary(
  announcement: PlatformAnnouncementDocument,
): PlatformAnnouncementSummary {
  return {
    id: announcement._id.toString(),
    title: announcement.title,
    message: announcement.message,
    targetType: announcement.targetType,
    targetPlanIds: announcement.targetPlanIds,
    targetWorkspaceIds: announcement.targetWorkspaceIds,
    createdBy: announcement.createdBy,
    createdAt: announcement.createdAt.toISOString(),
  };
}

/** Never includes passwordHash or any other internal field — the one place a cross-tenant UserDocument is flattened for Platform Search. */
export function toPlatformSearchUserSummary(user: UserDocument): PlatformSearchUserSummary {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    workspaceId: user.workspaceId,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toSupportTicketSummary(ticket: SupportTicketDocument): SupportTicketSummary {
  return {
    id: ticket._id.toString(),
    workspaceId: ticket.workspaceId,
    title: ticket.title,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    assignedOperator: ticket.assignedOperator,
    resolution: ticket.resolution,
    createdBy: ticket.createdBy,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

export function toSupportSessionSummary(session: SupportSessionDocument): SupportSessionSummary {
  return {
    id: session._id.toString(),
    workspaceId: session.workspaceId,
    requestedBy: session.requestedBy,
    approvedBy: session.approvedBy,
    reason: session.reason,
    durationMinutes: session.durationMinutes,
    status: session.status,
    approvedAt: session.approvedAt ? session.approvedAt.toISOString() : null,
    startedBy: session.startedBy,
    startedAt: session.startedAt ? session.startedAt.toISOString() : null,
    expiresAt: session.expiresAt ? session.expiresAt.toISOString() : null,
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
    terminationReason: session.terminationReason,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export function toPlatformAuditEntrySummary(
  entry: PlatformAuditEntryDocument,
): PlatformAuditEntrySummary {
  return {
    id: entry._id.toString(),
    eventType: entry.eventType,
    description: entry.description,
    workspaceId: entry.workspaceId,
    actorId: entry.actorId,
    metadata: entry.metadata,
    occurredAt: entry.occurredAt.toISOString(),
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toGovernancePolicySummary(
  policy: GovernancePolicyDocument,
): GovernancePolicySummary {
  return {
    key: policy.key,
    value: policy.value,
    version: policy.version,
    reason: policy.reason,
    updatedBy: policy.updatedBy,
    history: policy.history.map((entry) => ({
      value: entry.value,
      version: entry.version,
      reason: entry.reason,
      updatedBy: entry.updatedBy,
      updatedAt: entry.updatedAt.toISOString(),
    })),
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}
