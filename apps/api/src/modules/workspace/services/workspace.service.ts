import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TenantRole, WorkspaceMemberStatus } from "@wapp/shared-types";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  WorkspaceCreatedPayload,
  WorkspaceUpdatedPayload,
} from "../../../common/events/domain-events.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { AuthService, type RequestMeta } from "../../identity/services/auth.service.js";
import type { IssuedTokenPair } from "../../identity/identity.types.js";
import { WorkspaceRepository } from "../repositories/workspace.repository.js";
import { toWorkspaceProfile } from "../mappers/workspace.mapper.js";
import type { WorkspaceProfile } from "../workspace.types.js";
import type { CreateWorkspaceDto } from "../dto/create-workspace.dto.js";
import type { UpdateBusinessProfileDto } from "../dto/update-business-profile.dto.js";
import type { UpdateBusinessHoursDto } from "../dto/update-business-hours.dto.js";
import type { UpdateNotificationSettingsDto } from "../dto/update-notification-settings.dto.js";

/**
 * Owns Workspace creation and settings (Business Profile, Business Hours,
 * Notification Settings). Team/invitation lifecycle lives in TeamService —
 * kept separate since it's a materially different concern (member
 * management vs. workspace settings), mirroring Identity's own
 * service-per-concern split.
 */
@Injectable()
export class WorkspaceService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    userId: string,
    dto: CreateWorkspaceDto,
    meta: RequestMeta,
  ): Promise<{ workspace: WorkspaceProfile; tokens: IssuedTokenPair }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    // PRD-002 v1.1 — Phase-1 is strictly one User -> one Workspace.
    if (user.workspaceId) {
      throw new ConflictException("You already belong to a workspace");
    }

    const workspace = await this.workspaceRepository.create({
      name: dto.name,
      ownerId: userId,
    });
    const workspaceId = workspace._id.toString();

    await this.userRepository.assignWorkspaceMembership(
      userId,
      workspaceId,
      TenantRole.OWNER,
      WorkspaceMemberStatus.ACTIVE,
    );

    this.eventEmitter.emit(DomainEvent.WORKSPACE_CREATED, {
      workspaceId,
      ownerId: userId,
      name: workspace.name,
      occurredAt: new Date().toISOString(),
    } satisfies WorkspaceCreatedPayload);

    // The user's existing access token still has workspaceId/role = null —
    // reissue immediately so the client doesn't need a manual re-login to
    // proceed to the next onboarding step (Dashboard).
    const tokens = await this.authService.reissueTokens(userId, meta);

    return { workspace: toWorkspaceProfile(workspace), tokens };
  }

  async getById(workspaceId: string): Promise<WorkspaceProfile> {
    const workspace = await this.findOrThrow(workspaceId);
    return toWorkspaceProfile(workspace);
  }

  async updateBusinessProfile(
    workspaceId: string,
    dto: UpdateBusinessProfileDto,
    updatedBy: string,
  ): Promise<WorkspaceProfile> {
    await this.findOrThrow(workspaceId);
    await this.workspaceRepository.updateBusinessProfile(workspaceId, dto);
    this.emitUpdated(workspaceId, "business_profile", updatedBy);
    return this.getById(workspaceId);
  }

  async updateBusinessHours(
    workspaceId: string,
    dto: UpdateBusinessHoursDto,
    updatedBy: string,
  ): Promise<WorkspaceProfile> {
    await this.findOrThrow(workspaceId);

    if (dto.schedule) {
      const days = new Set(dto.schedule.map((day) => day.dayOfWeek));
      if (days.size !== dto.schedule.length) {
        throw new BadRequestException("schedule cannot contain duplicate dayOfWeek entries");
      }
    }

    await this.workspaceRepository.updateBusinessHours(workspaceId, dto);
    this.emitUpdated(workspaceId, "business_hours", updatedBy);
    return this.getById(workspaceId);
  }

  async updateNotificationSettings(
    workspaceId: string,
    dto: UpdateNotificationSettingsDto,
    updatedBy: string,
  ): Promise<WorkspaceProfile> {
    await this.findOrThrow(workspaceId);
    await this.workspaceRepository.updateNotificationSettings(workspaceId, dto);
    this.emitUpdated(workspaceId, "notification_settings", updatedBy);
    return this.getById(workspaceId);
  }

  private emitUpdated(
    workspaceId: string,
    section: WorkspaceUpdatedPayload["section"],
    updatedBy: string,
  ): void {
    this.eventEmitter.emit(DomainEvent.WORKSPACE_UPDATED, {
      workspaceId,
      section,
      updatedBy,
      occurredAt: new Date().toISOString(),
    } satisfies WorkspaceUpdatedPayload);
  }

  private async findOrThrow(workspaceId: string) {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }
    return workspace;
  }
}
