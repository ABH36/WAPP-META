import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WorkspaceStatus } from "@wapp/shared-types";
import {
  ListWorkspacesForPlatformFilter,
  WorkspaceRepository,
} from "../../workspace/repositories/workspace.repository.js";
import type { WorkspaceDocument } from "../../workspace/schemas/workspace.schema.js";
import { toPlatformWorkspaceSummary } from "../mappers/platform.mapper.js";
import type { PlatformWorkspaceSummary } from "../platform.types.js";
import {
  DomainEvent,
  WorkspaceArchivedPayload,
  WorkspaceReactivatedPayload,
  WorkspaceSuspendedPayload,
} from "../../../common/events/domain-events.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

export interface ListWorkspacesForPlatformResult {
  items: PlatformWorkspaceSummary[];
  total: number;
  page: number;
  limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/** PRD-007 Volume-1 §4.1 — Workspace Registry: list/search/filter + Suspend/Reactivate/Archive. */
@Injectable()
export class PlatformWorkspaceRegistryService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {}

  async list(
    filter: ListWorkspacesForPlatformFilter,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ): Promise<ListWorkspacesForPlatformResult> {
    const { items, total } = await this.workspaceRepository.listAllForPlatform(filter, page, limit);
    return { items: items.map(toPlatformWorkspaceSummary), total, page, limit };
  }

  async suspend(id: string, reason: string, actorId: string): Promise<PlatformWorkspaceSummary> {
    const workspace = await this.getExisting(id);
    if (workspace.status === WorkspaceStatus.ARCHIVED) {
      throw new BadRequestException("An archived workspace cannot be suspended");
    }
    if (workspace.status === WorkspaceStatus.SUSPENDED) {
      throw new BadRequestException("This workspace is already suspended");
    }

    const updated = await this.workspaceRepository.updateStatusWithReason(
      id,
      WorkspaceStatus.SUSPENDED,
      reason,
      actorId,
    );
    if (!updated) {
      throw new NotFoundException("Workspace not found");
    }

    const payload: WorkspaceSuspendedPayload = {
      workspaceId: id,
      reason,
      actorId,
      occurredAt: new Date().toISOString(),
    };
    this.eventEmitter.emit(DomainEvent.WORKSPACE_SUSPENDED, payload);
    this.metricsService.platformWorkspaceSuspensionTotal.inc({ action: "suspended" });

    return toPlatformWorkspaceSummary(updated);
  }

  async reactivate(id: string, actorId: string): Promise<PlatformWorkspaceSummary> {
    const workspace = await this.getExisting(id);
    if (workspace.status !== WorkspaceStatus.SUSPENDED) {
      throw new BadRequestException("Only a suspended workspace can be reactivated");
    }

    const updated = await this.workspaceRepository.updateStatusWithReason(
      id,
      WorkspaceStatus.ACTIVE,
      null,
      actorId,
    );
    if (!updated) {
      throw new NotFoundException("Workspace not found");
    }

    const payload: WorkspaceReactivatedPayload = {
      workspaceId: id,
      actorId,
      occurredAt: new Date().toISOString(),
    };
    this.eventEmitter.emit(DomainEvent.WORKSPACE_REACTIVATED, payload);
    this.metricsService.platformWorkspaceSuspensionTotal.inc({ action: "reactivated" });

    return toPlatformWorkspaceSummary(updated);
  }

  async archive(id: string, reason: string, actorId: string): Promise<PlatformWorkspaceSummary> {
    const workspace = await this.getExisting(id);
    if (workspace.status === WorkspaceStatus.ARCHIVED) {
      throw new BadRequestException("This workspace is already archived");
    }

    const updated = await this.workspaceRepository.updateStatusWithReason(
      id,
      WorkspaceStatus.ARCHIVED,
      reason,
      actorId,
    );
    if (!updated) {
      throw new NotFoundException("Workspace not found");
    }

    const payload: WorkspaceArchivedPayload = {
      workspaceId: id,
      reason,
      actorId,
      occurredAt: new Date().toISOString(),
    };
    this.eventEmitter.emit(DomainEvent.WORKSPACE_ARCHIVED, payload);

    return toPlatformWorkspaceSummary(updated);
  }

  private async getExisting(id: string): Promise<WorkspaceDocument> {
    const workspace = await this.workspaceRepository.findById(id);
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }
    return workspace;
  }
}
