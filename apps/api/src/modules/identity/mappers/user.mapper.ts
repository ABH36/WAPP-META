import type { UserDocument } from "../schemas/user.schema.js";
import type { SessionDocument } from "../schemas/session.schema.js";
import type { LoginHistoryEntryDocument } from "../schemas/login-history-entry.schema.js";
import type { LoginHistorySummary, SessionSummary, UserProfile } from "../identity.types.js";

/** The one place a UserDocument is flattened into what a client is allowed to see. */
export function toUserProfile(user: UserDocument): UserProfile {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    mobileNumber: user.mobileNumber,
    workspaceId: user.workspaceId,
    role: user.role,
    workspaceMemberStatus: user.workspaceMemberStatus,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toSessionSummary(session: SessionDocument): SessionSummary {
  return {
    id: session._id.toString(),
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  };
}

export function toLoginHistorySummary(entry: LoginHistoryEntryDocument): LoginHistorySummary {
  return {
    id: entry._id.toString(),
    success: entry.success,
    reason: entry.reason,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    createdAt: entry.createdAt.toISOString(),
  };
}
