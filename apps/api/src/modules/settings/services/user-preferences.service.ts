import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  NotificationPreferencesUpdatedPayload,
  ThemeChangedPayload,
  UserPreferencesUpdatedPayload,
} from "../../../common/events/domain-events.js";
import { UserPreferencesRepository } from "../repositories/user-preferences.repository.js";
import { WorkspaceSettingsRepository } from "../repositories/workspace-settings.repository.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import type { UpdatePreferencesDto } from "../dto/update-user-preferences.dto.js";
import type { UpdateThemeDto } from "../dto/update-theme.dto.js";
import type { UpdateDashboardDto } from "../dto/update-dashboard.dto.js";
import type { UpdateNotificationsDto } from "../dto/update-notifications.dto.js";
import type { EffectiveFormatSummary, UserSettingsOverview } from "../settings.types.js";

/**
 * PRD-006 Volume-2 §2/§3/§4.1-§4.4 — personal preferences, never shared
 * across Workspace members (BR-001). Self-scoped only (no `actorId` distinct
 * from `userId` anywhere — resolved 2026-08-07, Architecture Review, RBAC
 * for these routes is authentication-only, acting on your own account).
 * Date Format/Time Format are personal *overrides* of Workspace's own
 * Volume-1 defaults, resolved via the User Override -> Workspace Default ->
 * Effective Preference precedence — see
 * docs/ADR-SET-003-personal-preference-resolution-strategy.md. Emits its
 * own 3 events (never SETTINGS_UPDATED — that's Volume-1's workspace-scope
 * event) and never touches Identity's owned data (Password/Sessions/Login
 * History — see SecuritySettingsService for that orchestration).
 */
@Injectable()
export class UserPreferencesService {
  constructor(
    private readonly userPreferencesRepository: UserPreferencesRepository,
    private readonly workspaceSettingsRepository: WorkspaceSettingsRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getOverview(userId: string, workspaceId: string): Promise<UserSettingsOverview> {
    const [preferences, workspaceSettings, workspace] = await Promise.all([
      this.userPreferencesRepository.getOrCreate(userId),
      this.workspaceSettingsRepository.getOrCreate(workspaceId),
      this.workspaceRepository.findById(workspaceId),
    ]);

    return {
      userId,
      theme: preferences.theme,
      sidebar: preferences.sidebar,
      density: preferences.density,
      dateFormat: this.resolveEffective(preferences.dateFormat, workspaceSettings.dateFormat),
      timeFormat: this.resolveEffective(preferences.timeFormat, workspaceSettings.timeFormat),
      timezone: workspace?.businessHours.timezone ?? "Asia/Kolkata",
      defaultLandingPage: preferences.defaultLandingPage,
      pinnedPages: preferences.pinnedPages,
      favoriteModules: preferences.favoriteModules,
      notifications: preferences.notifications,
    };
  }

  async updatePreferences(
    userId: string,
    workspaceId: string,
    dto: UpdatePreferencesDto,
  ): Promise<UserSettingsOverview> {
    await this.userPreferencesRepository.updatePreferences(userId, dto);
    this.eventEmitter.emit(DomainEvent.USER_PREFERENCES_UPDATED, {
      workspaceId,
      userId,
      section: "preferences",
      occurredAt: new Date().toISOString(),
    } satisfies UserPreferencesUpdatedPayload);
    return this.getOverview(userId, workspaceId);
  }

  async updateTheme(
    userId: string,
    workspaceId: string,
    dto: UpdateThemeDto,
  ): Promise<UserSettingsOverview> {
    await this.userPreferencesRepository.updateTheme(userId, dto);
    this.eventEmitter.emit(DomainEvent.THEME_CHANGED, {
      workspaceId,
      userId,
      occurredAt: new Date().toISOString(),
    } satisfies ThemeChangedPayload);
    return this.getOverview(userId, workspaceId);
  }

  async updateDashboard(
    userId: string,
    workspaceId: string,
    dto: UpdateDashboardDto,
  ): Promise<UserSettingsOverview> {
    await this.userPreferencesRepository.updateDashboard(userId, dto);
    this.eventEmitter.emit(DomainEvent.USER_PREFERENCES_UPDATED, {
      workspaceId,
      userId,
      section: "dashboard",
      occurredAt: new Date().toISOString(),
    } satisfies UserPreferencesUpdatedPayload);
    return this.getOverview(userId, workspaceId);
  }

  async updateNotifications(
    userId: string,
    workspaceId: string,
    dto: UpdateNotificationsDto,
  ): Promise<UserSettingsOverview> {
    await this.userPreferencesRepository.updateNotifications(userId, {
      notifications: dto.notifications,
    });
    this.eventEmitter.emit(DomainEvent.NOTIFICATION_PREFERENCES_UPDATED, {
      workspaceId,
      userId,
      occurredAt: new Date().toISOString(),
    } satisfies NotificationPreferencesUpdatedPayload);
    return this.getOverview(userId, workspaceId);
  }

  private resolveEffective(
    userValue: string | null,
    workspaceValue: string,
  ): EffectiveFormatSummary {
    return userValue !== null
      ? { value: userValue, source: "USER" }
      : { value: workspaceValue, source: "WORKSPACE" };
  }
}
