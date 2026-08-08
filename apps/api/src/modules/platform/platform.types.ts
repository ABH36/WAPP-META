import type { PlatformRole, WorkspaceStatus } from "@wapp/shared-types";
import type { AnnouncementTargetType } from "./schemas/platform-announcement.schema.js";
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "./schemas/support-ticket.schema.js";

/** PRD-007 Volume-1 — a distinct `type` discriminator from the tenant AccessTokenPayload's `"access"`, on top of the already-separate signing secret. */
export interface PlatformAccessTokenPayload {
  sub: string;
  role: PlatformRole;
  type: "platform_access";
}

export interface PlatformRefreshTokenPayload {
  sub: string;
  jti: string;
  type: "platform_refresh";
}

export interface AuthenticatedPlatformUser {
  platformUserId: string;
  role: PlatformRole;
}

export interface IssuedPlatformTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PlatformUserProfile {
  id: string;
  fullName: string;
  email: string;
  role: PlatformRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** §4.1 — the one place a WorkspaceDocument is flattened into what a Platform client is allowed to see. */
export interface PlatformWorkspaceSummary {
  id: string;
  name: string;
  ownerId: string;
  status: WorkspaceStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  statusChangedBy: string | null;
  createdAt: string;
}

/** §4.4. */
export interface PlatformAnnouncementSummary {
  id: string;
  title: string;
  message: string;
  targetType: AnnouncementTargetType;
  targetPlanIds: string[];
  targetWorkspaceIds: string[];
  createdBy: string;
  createdAt: string;
}

/** §4.6 — Workspace Search's User result, deliberately minimal (no passwordHash, no internal fields). */
export interface PlatformSearchUserSummary {
  id: string;
  fullName: string;
  email: string;
  workspaceId: string | null;
  createdAt: string;
}

/** PRD-007 Volume-2 §4.6. */
export interface SupportTicketSummary {
  id: string;
  workspaceId: string;
  title: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assignedOperator: string | null;
  resolution: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
