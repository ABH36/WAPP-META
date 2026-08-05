import { Body, Controller, Get, Patch } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { AutomationService } from "../services/automation.service.js";
import { UpdateAutomationSettingsDto } from "../dto/update-automation-settings.dto.js";
import type { AutomationSettingsSummary } from "../communication.types.js";

// Reuses Workspace's own EDIT_WORKSPACE/VIEW_WORKSPACE permissions — same
// tier as Business Hours/Notification Settings (WorkspaceController), since
// Welcome/Away configuration is the same kind of admin-level setting, just
// Communication-owned rather than Workspace-owned (see
// docs/COMM-AUTOMATION-BUSINESS-HOURS.md).
@Controller({ path: "communication/automation-settings", version: "1" })
export class AutomationSettingsController {
  constructor(private readonly automationService: AutomationService) {}

  @RequirePermission(Permission.VIEW_WORKSPACE)
  @Get()
  async get(@CurrentUser() user: AuthenticatedUser): Promise<AutomationSettingsSummary> {
    return this.automationService.getSettings(user.workspaceId!);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch()
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAutomationSettingsDto,
  ): Promise<AutomationSettingsSummary> {
    return this.automationService.updateSettings(user.workspaceId!, dto, user.userId);
  }
}
