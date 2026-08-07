import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WorkspaceModule } from "../workspace/workspace.module.js";
import { StorageModule } from "../../infrastructure/storage/storage.module.js";
import { WorkspaceSettings, WorkspaceSettingsSchema } from "./schemas/workspace-settings.schema.js";
import { WorkspaceSettingsRepository } from "./repositories/workspace-settings.repository.js";
import { SettingsService } from "./services/settings.service.js";
import { SettingsController } from "./controllers/settings.controller.js";

/**
 * Workspace Settings (Phase-7, PRD-006 Volume-1). Owns only `workspace_settings`
 * (branding reference + display preferences) — an orchestration layer over
 * Workspace's existing Business Profile/Business Hours/Notification Settings/
 * Language, never their owner. Imports WorkspaceModule for WorkspaceRepository
 * (one-directional — Settings depends on Workspace, never the reverse, same
 * pattern every other business module already follows) and StorageModule
 * directly (business modules import only the specific infrastructure
 * sub-piece they need, per InfrastructureModule's own doc comment) to reuse
 * the existing Cloudinary-signed-upload flow for logos. See
 * docs/ADR-SET-001-settings-ownership-strategy.md and
 * docs/ADR-SET-002-workspace-branding-strategy.md.
 */
@Module({
  imports: [
    WorkspaceModule,
    StorageModule,
    MongooseModule.forFeature([{ name: WorkspaceSettings.name, schema: WorkspaceSettingsSchema }]),
  ],
  controllers: [SettingsController],
  providers: [WorkspaceSettingsRepository, SettingsService],
})
export class SettingsModule {}
