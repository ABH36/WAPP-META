import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  WorkspaceSettings,
  WorkspaceSettingsDocument,
} from "../schemas/workspace-settings.schema.js";
import type { ExportFormat } from "../schemas/export-job.schema.js";

export interface UpdatePreferencesInput {
  currency?: string;
  dateFormat?: string;
  timeFormat?: string;
}

export interface UpdateLogoInput {
  logoUrl: string | null;
  logoPublicId: string | null;
}

export interface UpdateSystemPreferencesInput {
  defaultPagination?: number;
  exportFormat?: ExportFormat;
  dashboardRefreshInterval?: number;
}

@Injectable()
export class WorkspaceSettingsRepository {
  constructor(
    @InjectModel(WorkspaceSettings.name)
    private readonly workspaceSettingsModel: Model<WorkspaceSettingsDocument>,
  ) {}

  /** Idempotent get-or-create — every Workspace gets a settings document lazily, on first access, rather than reactively on WORKSPACE_CREATED. */
  async getOrCreate(workspaceId: string): Promise<WorkspaceSettingsDocument> {
    return this.workspaceSettingsModel
      .findOneAndUpdate(
        { workspaceId },
        { $setOnInsert: { workspaceId } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async updatePreferences(
    workspaceId: string,
    input: UpdatePreferencesInput,
  ): Promise<WorkspaceSettingsDocument> {
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        update[key] = value;
      }
    }
    return this.workspaceSettingsModel
      .findOneAndUpdate(
        { workspaceId },
        { $set: update },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async updateLogo(
    workspaceId: string,
    input: UpdateLogoInput,
  ): Promise<WorkspaceSettingsDocument> {
    return this.workspaceSettingsModel
      .findOneAndUpdate(
        { workspaceId },
        { $set: input },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  /** PRD-006 Volume-4 §4.6. */
  async updateMaintenanceMode(
    workspaceId: string,
    maintenanceMode: boolean,
  ): Promise<WorkspaceSettingsDocument> {
    return this.workspaceSettingsModel
      .findOneAndUpdate(
        { workspaceId },
        { $set: { maintenanceMode } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  /** PRD-006 Volume-4 §4.8. */
  async updateSystemPreferences(
    workspaceId: string,
    input: UpdateSystemPreferencesInput,
  ): Promise<WorkspaceSettingsDocument> {
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        update[key] = value;
      }
    }
    return this.workspaceSettingsModel
      .findOneAndUpdate(
        { workspaceId },
        { $set: update },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}
