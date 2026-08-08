import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WorkspaceModule } from "../workspace/workspace.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { StorageModule } from "../../infrastructure/storage/storage.module.js";
import { WorkspaceSettings, WorkspaceSettingsSchema } from "./schemas/workspace-settings.schema.js";
import { UserPreferences, UserPreferencesSchema } from "./schemas/user-preferences.schema.js";
import { WorkspaceSettingsRepository } from "./repositories/workspace-settings.repository.js";
import { UserPreferencesRepository } from "./repositories/user-preferences.repository.js";
import { SettingsService } from "./services/settings.service.js";
import { UserPreferencesService } from "./services/user-preferences.service.js";
import { SecuritySettingsService } from "./services/security-settings.service.js";
import { SettingsController } from "./controllers/settings.controller.js";
import { UserPreferencesController } from "./controllers/user-preferences.controller.js";
import { SecuritySettingsController } from "./controllers/security-settings.controller.js";

/**
 * Workspace Settings (Phase-7, PRD-006). Part-1 (Volume-1) owns
 * `workspace_settings` (branding reference + workspace-level display
 * preferences) — an orchestration layer over Workspace's existing Business
 * Profile/Business Hours/Notification Settings/Language, never their owner.
 * See docs/ADR-SET-001-settings-ownership-strategy.md and
 * docs/ADR-SET-002-workspace-branding-strategy.md.
 *
 * Part-2 (Volume-2) adds `user_preferences` (personal, per-user — never
 * shared across Workspace members, BR-001) and orchestrates Identity for
 * Password/Sessions/Login History (imports IdentityModule for AuthService,
 * one-directional — Settings depends on Identity, never the reverse).
 * Personal Date Format/Time Format are nullable overrides of Volume-1's
 * Workspace-level defaults — see
 * docs/ADR-SET-003-personal-preference-resolution-strategy.md and
 * docs/ADR-SET-004-identity-orchestration-strategy.md.
 */
@Module({
  imports: [
    WorkspaceModule,
    IdentityModule,
    StorageModule,
    MongooseModule.forFeature([
      { name: WorkspaceSettings.name, schema: WorkspaceSettingsSchema },
      { name: UserPreferences.name, schema: UserPreferencesSchema },
    ]),
  ],
  controllers: [SettingsController, UserPreferencesController, SecuritySettingsController],
  providers: [
    WorkspaceSettingsRepository,
    UserPreferencesRepository,
    SettingsService,
    UserPreferencesService,
    SecuritySettingsService,
  ],
})
export class SettingsModule {}
