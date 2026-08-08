import type { WorkspaceDocument } from "../../workspace/schemas/workspace.schema.js";
import type { UserDocument } from "../../identity/schemas/user.schema.js";
import type { PlatformAnnouncementDocument } from "../schemas/platform-announcement.schema.js";
import type {
  PlatformAnnouncementSummary,
  PlatformSearchUserSummary,
  PlatformWorkspaceSummary,
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
