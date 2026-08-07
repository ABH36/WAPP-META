import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { SettingsUpdatedPayload } from "../../../common/events/domain-events.js";
import { WorkspaceSettingsRepository } from "../repositories/workspace-settings.repository.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { StorageService } from "../../../infrastructure/storage/storage.service.js";
import type { UpdatePreferencesDto } from "../dto/update-preferences.dto.js";
import type { UpdateLogoDto } from "../dto/update-logo.dto.js";
import type { LogoUploadSignature, SettingsOverview } from "../settings.types.js";
import type { WorkspaceSettingsDocument } from "../schemas/workspace-settings.schema.js";
import type { WorkspaceDocument } from "../../workspace/schemas/workspace.schema.js";

const LOGO_UPLOAD_FOLDER_PREFIX = "workspaces";

/**
 * PRD-006 Volume-1 (Workspace Settings). §3 — Settings orchestrates
 * Workspace's existing Business Profile/Business Hours/Notification
 * Settings/Language (read-only composition, never writes to them — those
 * stay behind Workspace's own existing endpoints) and owns only Branding/
 * Currency/Date Format/Time Format, which had no prior bounded-context
 * owner. See docs/ADR-SET-001-settings-ownership-strategy.md.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly workspaceSettingsRepository: WorkspaceSettingsRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getOverview(workspaceId: string): Promise<SettingsOverview> {
    const [workspace, settings] = await Promise.all([
      this.findWorkspaceOrThrow(workspaceId),
      this.workspaceSettingsRepository.getOrCreate(workspaceId),
    ]);
    return this.toOverview(workspace, settings);
  }

  async updatePreferences(
    workspaceId: string,
    dto: UpdatePreferencesDto,
    actorId: string,
  ): Promise<SettingsOverview> {
    const workspace = await this.findWorkspaceOrThrow(workspaceId);
    const settings = await this.workspaceSettingsRepository.updatePreferences(workspaceId, dto);

    this.eventEmitter.emit(DomainEvent.SETTINGS_UPDATED, {
      workspaceId,
      section: "preferences",
      updatedBy: actorId,
      occurredAt: new Date().toISOString(),
    } satisfies SettingsUpdatedPayload);

    return this.toOverview(workspace, settings);
  }

  /** §Reuse StorageService (SEC-016) — Settings never handles file bytes, only the resulting reference. Synchronous (no network call — StorageService.generateUploadSignature only signs, doesn't call Cloudinary). */
  getLogoUploadSignature(workspaceId: string): LogoUploadSignature {
    return this.storageService.generateUploadSignature(
      `${LOGO_UPLOAD_FOLDER_PREFIX}/${workspaceId}/logos`,
    );
  }

  /** Called by the client after it has already uploaded directly to Cloudinary using the signature above. Deletes the previous logo asset, if any, to avoid orphaning it. */
  async updateLogo(
    workspaceId: string,
    dto: UpdateLogoDto,
    actorId: string,
  ): Promise<SettingsOverview> {
    const workspace = await this.findWorkspaceOrThrow(workspaceId);
    const existing = await this.workspaceSettingsRepository.getOrCreate(workspaceId);
    if (existing.logoPublicId) {
      await this.storageService.deleteAsset(existing.logoPublicId);
    }

    const settings = await this.workspaceSettingsRepository.updateLogo(workspaceId, {
      logoUrl: dto.logoUrl,
      logoPublicId: dto.logoPublicId,
    });

    this.eventEmitter.emit(DomainEvent.SETTINGS_UPDATED, {
      workspaceId,
      section: "branding",
      updatedBy: actorId,
      occurredAt: new Date().toISOString(),
    } satisfies SettingsUpdatedPayload);

    return this.toOverview(workspace, settings);
  }

  async removeLogo(workspaceId: string, actorId: string): Promise<SettingsOverview> {
    const workspace = await this.findWorkspaceOrThrow(workspaceId);
    const existing = await this.workspaceSettingsRepository.getOrCreate(workspaceId);
    if (existing.logoPublicId) {
      await this.storageService.deleteAsset(existing.logoPublicId);
    }

    const settings = await this.workspaceSettingsRepository.updateLogo(workspaceId, {
      logoUrl: null,
      logoPublicId: null,
    });

    this.eventEmitter.emit(DomainEvent.SETTINGS_UPDATED, {
      workspaceId,
      section: "branding",
      updatedBy: actorId,
      occurredAt: new Date().toISOString(),
    } satisfies SettingsUpdatedPayload);

    return this.toOverview(workspace, settings);
  }

  private toOverview(
    workspace: WorkspaceDocument,
    settings: WorkspaceSettingsDocument,
  ): SettingsOverview {
    return {
      workspaceId: workspace._id.toString(),
      businessProfile: workspace.businessProfile,
      businessHours: workspace.businessHours,
      notificationSettings: workspace.notificationSettings,
      language: workspace.language,
      branding: { logoUrl: settings.logoUrl },
      preferences: {
        currency: settings.currency,
        dateFormat: settings.dateFormat,
        timeFormat: settings.timeFormat,
      },
    };
  }

  private async findWorkspaceOrThrow(workspaceId: string): Promise<WorkspaceDocument> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }
    return workspace;
  }
}
