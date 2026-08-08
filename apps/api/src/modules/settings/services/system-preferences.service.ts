import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WorkspaceSettingsRepository } from "../repositories/workspace-settings.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { SystemPreferenceUpdatedPayload } from "../../../common/events/domain-events.js";
import type { UpdateSystemPreferencesDto } from "../dto/update-system-preferences.dto.js";
import type { SystemPreferencesSummary } from "../settings.types.js";

/** PRD-006 Volume-4 §4.8 — workspace-level operational preferences, no business logic. */
@Injectable()
export class SystemPreferencesService {
  constructor(
    private readonly workspaceSettingsRepository: WorkspaceSettingsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async get(workspaceId: string): Promise<SystemPreferencesSummary> {
    const settings = await this.workspaceSettingsRepository.getOrCreate(workspaceId);
    return {
      defaultPagination: settings.defaultPagination,
      exportFormat: settings.exportFormat,
      dashboardRefreshInterval: settings.dashboardRefreshInterval,
    };
  }

  async update(
    workspaceId: string,
    actorId: string,
    dto: UpdateSystemPreferencesDto,
  ): Promise<SystemPreferencesSummary> {
    const settings = await this.workspaceSettingsRepository.updateSystemPreferences(
      workspaceId,
      dto,
    );

    this.eventEmitter.emit(DomainEvent.SYSTEM_PREFERENCE_UPDATED, {
      workspaceId,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies SystemPreferenceUpdatedPayload);

    return {
      defaultPagination: settings.defaultPagination,
      exportFormat: settings.exportFormat,
      dashboardRefreshInterval: settings.dashboardRefreshInterval,
    };
  }
}
