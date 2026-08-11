/** FRD-001 Volume-4 §4.9 — mirrors `apps/api`'s local `AssignmentStrategy` enum (`automation-settings.schema.ts`), no `@wapp/shared-types` equivalent exists. */
export type AssignmentStrategy = "NONE" | "ROUND_ROBIN" | "LEAST_ACTIVE";

/** Mirrors `AutomationSettingsSummary` exactly — one Settings object per workspace, NOT a list of named rules. Architecture Review, 2026-08-11: presented in the UI as "Automation Settings" (two toggles + one strategy dropdown), never "Automation Rules." */
export interface AutomationSettingsSummary {
  welcomeMessageEnabled: boolean;
  welcomeMessageText: string | null;
  awayMessageEnabled: boolean;
  awayMessageText: string | null;
  assignmentStrategy: AssignmentStrategy;
  updatedAt: string | null;
}
