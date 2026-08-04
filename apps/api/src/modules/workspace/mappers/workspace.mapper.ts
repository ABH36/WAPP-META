import { InvitationStatus } from "@wapp/shared-types";
import type { WorkspaceDocument } from "../schemas/workspace.schema.js";
import type { UserDocument } from "../../identity/schemas/user.schema.js";
import {
  PersistedInvitationStatus,
  type WorkspaceInvitationDocument,
} from "../schemas/workspace-invitation.schema.js";
import type { InvitationSummary, MemberSummary, WorkspaceProfile } from "../workspace.types.js";

export function toWorkspaceProfile(workspace: WorkspaceDocument): WorkspaceProfile {
  return {
    id: workspace._id.toString(),
    name: workspace.name,
    ownerId: workspace.ownerId.toString(),
    businessProfile: {
      category: workspace.businessProfile.category,
      description: workspace.businessProfile.description,
      gstin: workspace.businessProfile.gstin,
    },
    businessHours: {
      timezone: workspace.businessHours.timezone,
      schedule: workspace.businessHours.schedule.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        isOpen: day.isOpen,
        openTime: day.openTime,
        closeTime: day.closeTime,
      })),
      publicHolidays: workspace.businessHours.publicHolidays.map((holiday) => ({
        date: holiday.date,
        name: holiday.name,
      })),
    },
    notificationSettings: {
      taskFollowUpReminder: workspace.notificationSettings.taskFollowUpReminder,
      conversationLeadAssignment: workspace.notificationSettings.conversationLeadAssignment,
      broadcastCompleted: workspace.notificationSettings.broadcastCompleted,
      subscriptionReminder: workspace.notificationSettings.subscriptionReminder,
    },
    language: workspace.language,
    status: workspace.status,
    trialEndsAt: workspace.trialEndsAt.toISOString(),
    createdAt: workspace.createdAt.toISOString(),
  };
}

/** `user` must already be workspace-scoped (workspaceId/role/workspaceMemberStatus non-null) — the caller is responsible for that invariant. */
export function toMemberSummary(user: UserDocument): MemberSummary {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    mobileNumber: user.mobileNumber,
    role: user.role!,
    workspaceMemberStatus: user.workspaceMemberStatus!,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toInvitationSummary(invitation: WorkspaceInvitationDocument): InvitationSummary {
  const isExpired =
    invitation.status === PersistedInvitationStatus.PENDING && invitation.expiresAt < new Date();

  const status: InvitationStatus = isExpired
    ? InvitationStatus.EXPIRED
    : (invitation.status as unknown as InvitationStatus);

  return {
    id: invitation._id.toString(),
    email: invitation.email,
    role: invitation.role,
    status,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
  };
}
