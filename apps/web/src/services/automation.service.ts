import { apiGet, apiPatch } from "../lib/api";
import type { AssignmentStrategy, AutomationSettingsSummary } from "../types/automation";

export interface UpdateAutomationSettingsPayload {
  welcomeMessageEnabled?: boolean;
  welcomeMessageText?: string | null;
  awayMessageEnabled?: boolean;
  awayMessageText?: string | null;
  assignmentStrategy?: AssignmentStrategy;
}

/** FRD-001 Volume-4 §4.9 — one Settings object per workspace (Welcome/Away toggles + assignment strategy), not a rule list. Reuses Workspace's own `VIEW_WORKSPACE`/`EDIT_WORKSPACE` permissions — same tier as Business Hours/Notification Settings, not a Communication-specific permission. */
export const automationService = {
  get(): Promise<AutomationSettingsSummary> {
    return apiGet("/communication/automation-settings");
  },

  update(payload: UpdateAutomationSettingsPayload): Promise<AutomationSettingsSummary> {
    return apiPatch("/communication/automation-settings", payload);
  },
};
