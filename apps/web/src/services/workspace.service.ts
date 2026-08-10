import { apiGet } from "../lib/api";
import type { WorkspaceSummary } from "../types/workspace";

/** FRD-001 Volume-2 §4.4 — only what Profile needs. `GET /workspaces/me` (not `/workspaces/:id` — that route doesn't exist; the backend resolves "current workspace" from the authenticated user's own `workspaceId`, mirroring `/auth/me`'s shape). */
export const workspaceService = {
  current(): Promise<WorkspaceSummary> {
    return apiGet("/workspaces/me");
  },
};
