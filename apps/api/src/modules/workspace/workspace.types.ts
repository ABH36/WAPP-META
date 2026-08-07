import type {
  InvitationStatus,
  TenantRole,
  WorkspaceMemberStatus,
  WorkspaceStatus,
} from "@wapp/shared-types";

export interface WorkspaceProfile {
  id: string;
  name: string;
  ownerId: string;
  businessProfile: {
    category: string | null;
    description: string | null;
    gstin: string | null;
  };
  businessHours: {
    timezone: string;
    schedule: Array<{
      dayOfWeek: number;
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    }>;
    publicHolidays: Array<{ date: string; name: string }>;
  };
  notificationSettings: {
    taskFollowUpReminder: boolean;
    conversationLeadAssignment: boolean;
    broadcastCompleted: boolean;
    subscriptionReminder: boolean;
  };
  language: string;
  status: WorkspaceStatus;
  createdAt: string;
}

export interface MemberSummary {
  id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  role: TenantRole;
  workspaceMemberStatus: WorkspaceMemberStatus;
  createdAt: string;
}

export interface InvitationSummary {
  id: string;
  email: string;
  role: TenantRole;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
}
