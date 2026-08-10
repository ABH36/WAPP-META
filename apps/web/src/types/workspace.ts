/**
 * FRD-001 Volume-2 §4.4 — mirrors only the two fields Profile needs
 * (`id`/`name`) from `apps/api`'s much larger `WorkspaceProfile`
 * (businessProfile, businessHours, notificationSettings, etc.). Full
 * Workspace UI (FRD-001 Volume-3) will expand this type as it needs more
 * fields — not duplicated ahead of that need.
 */
export interface WorkspaceSummary {
  id: string;
  name: string;
}
