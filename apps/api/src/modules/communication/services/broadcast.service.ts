import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  BroadcastCompletedPayload,
  BroadcastFinishedPayload,
  BroadcastStartedPayload,
} from "../../../common/events/domain-events.js";
import { BroadcastRepository } from "../repositories/broadcast.repository.js";
import {
  BroadcastRecipientRepository,
  type BroadcastRecipientStats,
} from "../repositories/broadcast-recipient.repository.js";
import { TemplateRepository } from "../repositories/template.repository.js";
import { PhoneNumberRepository } from "../repositories/phone-number.repository.js";
import { ContactRepository } from "../repositories/contact.repository.js";
import { MessageService } from "./message.service.js";
import {
  toBroadcastRecipientSummary,
  toBroadcastSummary,
} from "../mappers/communication.mapper.js";
import type { BroadcastRecipientSummary, BroadcastSummary } from "../communication.types.js";
import type { CreateBroadcastDto } from "../dto/create-broadcast.dto.js";
import { BroadcastStatus, type BroadcastDocument } from "../schemas/broadcast.schema.js";
import { TemplateStatus } from "../schemas/template.schema.js";
import {
  BROADCAST_EXECUTION_QUEUE,
  BROADCAST_RECIPIENT_BATCH_SIZE,
  BROADCAST_SEND_DELAY_MS,
} from "../queue/broadcast-execution.constants.js";
import type { Paginated } from "../../../common/interceptors/response.interceptor.js";
import { CorrelationContextService } from "../../../common/observability/correlation-context.service.js";
import { withCorrelationId } from "../../../common/observability/job-context.util.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

const JOB_NAME = "run";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Broadcast lifecycle (PRD-003 Part 3b-i) — a one-time template send to an
 * explicit Contact list. See docs/COMM-BROADCAST-LIFECYCLE.md for the
 * audience model, no-per-recipient-personalization scoping, and the
 * sequential-single-job execution scaling caveat.
 */
@Injectable()
export class BroadcastService {
  constructor(
    private readonly broadcastRepository: BroadcastRepository,
    private readonly recipientRepository: BroadcastRecipientRepository,
    private readonly templateRepository: TemplateRepository,
    private readonly phoneNumberRepository: PhoneNumberRepository,
    private readonly contactRepository: ContactRepository,
    private readonly messageService: MessageService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(BROADCAST_EXECUTION_QUEUE) private readonly queue: Queue,
    private readonly correlationContext: CorrelationContextService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * `campaignId` is never accepted from the public DTO/controller — only
   * CampaignService passes it, when creating a wave (see
   * docs/COMM-CAMPAIGN-LIFECYCLE.md). A standalone Broadcast never has one.
   */
  async create(
    workspaceId: string,
    createdBy: string,
    dto: CreateBroadcastDto,
    campaignId?: string,
  ): Promise<BroadcastSummary> {
    const template = await this.templateRepository.findByIdForWorkspace(
      workspaceId,
      dto.templateId,
    );
    if (!template) {
      throw new NotFoundException("Template not found");
    }
    const phoneNumber = await this.phoneNumberRepository.findByIdForWorkspace(
      workspaceId,
      dto.phoneNumberId,
    );
    if (!phoneNumber) {
      throw new NotFoundException("Phone number not found");
    }

    const uniqueContactIds = [...new Set(dto.targetContactIds)];
    if (uniqueContactIds.length === 0) {
      throw new BadRequestException("At least one target Contact is required");
    }
    const contacts = await this.contactRepository.findByIdsForWorkspace(
      workspaceId,
      uniqueContactIds,
    );
    if (contacts.length !== uniqueContactIds.length) {
      throw new BadRequestException("One or more target Contacts do not belong to this workspace");
    }

    const status = dto.scheduledAt ? BroadcastStatus.SCHEDULED : BroadcastStatus.DRAFT;
    const broadcast = await this.broadcastRepository.create({
      workspaceId,
      name: dto.name,
      templateId: dto.templateId,
      phoneNumberId: dto.phoneNumberId,
      campaignId: campaignId ?? null,
      bodyParameters: dto.bodyParameters,
      status,
      scheduledAt: dto.scheduledAt ?? null,
      createdBy,
    });

    await this.recipientRepository.bulkCreatePending(
      workspaceId,
      broadcast._id.toString(),
      uniqueContactIds,
    );
    this.metricsService.communicationBroadcastsTotal.inc({ status });

    if (dto.scheduledAt) {
      const delay = Math.max(0, dto.scheduledAt.getTime() - Date.now());
      await this.queue.add(
        JOB_NAME,
        withCorrelationId(
          { workspaceId, broadcastId: broadcast._id.toString() },
          this.correlationContext.getOrCreateCorrelationId(),
        ),
        { delay },
      );
    }

    return toBroadcastSummary(broadcast);
  }

  async list(workspaceId: string): Promise<BroadcastSummary[]> {
    const broadcasts = await this.broadcastRepository.findByWorkspace(workspaceId);
    return broadcasts.map(toBroadcastSummary);
  }

  async getById(workspaceId: string, id: string): Promise<BroadcastSummary> {
    const broadcast = await this.findOrThrow(workspaceId, id);
    return toBroadcastSummary(broadcast);
  }

  async getStats(workspaceId: string, id: string): Promise<BroadcastRecipientStats> {
    await this.findOrThrow(workspaceId, id);
    return this.recipientRepository.getStats(id);
  }

  async listRecipients(
    workspaceId: string,
    id: string,
    page: number,
    limit: number,
  ): Promise<Paginated<BroadcastRecipientSummary>> {
    await this.findOrThrow(workspaceId, id);
    const { items, total } = await this.recipientRepository.findByBroadcast(
      workspaceId,
      id,
      page,
      limit,
    );
    return {
      items: items.map(toBroadcastRecipientSummary),
      meta: {
        page,
        pageSize: limit,
        totalRecords: total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  /** Sends a DRAFT broadcast immediately — a SCHEDULED one already has its own delayed job. */
  async send(workspaceId: string, id: string, actorId: string): Promise<BroadcastSummary> {
    const broadcast = await this.findOrThrow(workspaceId, id);
    if (broadcast.status !== BroadcastStatus.DRAFT) {
      throw new BadRequestException(
        `Only a DRAFT broadcast can be sent directly (current status: ${broadcast.status})`,
      );
    }

    const updated = await this.broadcastRepository.updateStatus(id, BroadcastStatus.RUNNING, {
      startedAt: new Date(),
    });
    await this.queue.add(
      JOB_NAME,
      withCorrelationId(
        { workspaceId, broadcastId: id },
        this.correlationContext.getOrCreateCorrelationId(),
      ),
    );

    this.eventEmitter.emit(DomainEvent.BROADCAST_STARTED, {
      workspaceId,
      broadcastId: id,
      startedBy: actorId,
      occurredAt: new Date().toISOString(),
    } satisfies BroadcastStartedPayload);

    return toBroadcastSummary(updated!);
  }

  async pause(workspaceId: string, id: string): Promise<BroadcastSummary> {
    const broadcast = await this.findOrThrow(workspaceId, id);
    if (
      broadcast.status !== BroadcastStatus.RUNNING &&
      broadcast.status !== BroadcastStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        `Only a RUNNING or SCHEDULED broadcast can be paused (current status: ${broadcast.status})`,
      );
    }
    const updated = await this.broadcastRepository.updateStatus(id, BroadcastStatus.PAUSED);
    return toBroadcastSummary(updated!);
  }

  async resume(workspaceId: string, id: string): Promise<BroadcastSummary> {
    const broadcast = await this.findOrThrow(workspaceId, id);
    if (broadcast.status !== BroadcastStatus.PAUSED) {
      throw new BadRequestException(
        `Only a PAUSED broadcast can be resumed (current status: ${broadcast.status})`,
      );
    }
    const updated = await this.broadcastRepository.updateStatus(id, BroadcastStatus.RUNNING);
    await this.queue.add(
      JOB_NAME,
      withCorrelationId(
        { workspaceId, broadcastId: id },
        this.correlationContext.getOrCreateCorrelationId(),
      ),
    );
    return toBroadcastSummary(updated!);
  }

  async cancel(workspaceId: string, id: string): Promise<BroadcastSummary> {
    const broadcast = await this.findOrThrow(workspaceId, id);
    const terminal: BroadcastStatus[] = [
      BroadcastStatus.COMPLETED,
      BroadcastStatus.CANCELLED,
      BroadcastStatus.FAILED,
    ];
    if (terminal.includes(broadcast.status)) {
      throw new BadRequestException(`Broadcast is already ${broadcast.status}`);
    }
    const updated = await this.broadcastRepository.updateStatus(id, BroadcastStatus.CANCELLED);
    this.emitFinished(workspaceId, id, broadcast.campaignId, BroadcastStatus.CANCELLED);
    return toBroadcastSummary(updated!);
  }

  /**
   * The actual fan-out — called by BroadcastExecutionProcessor, never
   * directly from a controller. Sequential, single-job execution per run;
   * see docs/COMM-BROADCAST-LIFECYCLE.md for why, and its documented
   * scaling limit.
   */
  async executeRun(workspaceId: string, broadcastId: string): Promise<void> {
    const broadcast = await this.broadcastRepository.findByIdForWorkspace(workspaceId, broadcastId);
    if (!broadcast) {
      return;
    }
    if (
      broadcast.status !== BroadcastStatus.RUNNING &&
      broadcast.status !== BroadcastStatus.SCHEDULED
    ) {
      // Paused/cancelled before this job started (race with a scheduled
      // delay), or already terminal — nothing to do.
      return;
    }

    const template = await this.templateRepository.findByIdForWorkspace(
      workspaceId,
      broadcast.templateId.toString(),
    );
    if (!template || template.status !== TemplateStatus.APPROVED) {
      await this.broadcastRepository.updateStatus(broadcastId, BroadcastStatus.FAILED, {
        failureReason: "Template is not (or is no longer) approved",
      });
      this.emitFinished(workspaceId, broadcastId, broadcast.campaignId, BroadcastStatus.FAILED);
      return;
    }

    if (broadcast.status === BroadcastStatus.SCHEDULED) {
      await this.broadcastRepository.updateStatus(broadcastId, BroadcastStatus.RUNNING, {
        startedAt: new Date(),
      });
    }

    await this.processRecipients(workspaceId, broadcast);
  }

  private async processRecipients(
    workspaceId: string,
    broadcast: BroadcastDocument,
  ): Promise<void> {
    const broadcastId = broadcast._id.toString();

    let batch = await this.recipientRepository.findPendingBatch(
      broadcastId,
      BROADCAST_RECIPIENT_BATCH_SIZE,
    );
    while (batch.length > 0) {
      for (const recipient of batch) {
        // Re-checked between sends (not just at batch boundaries) so a
        // pause/cancel takes effect promptly on a large run.
        const current = await this.broadcastRepository.findByIdForWorkspace(
          workspaceId,
          broadcastId,
        );
        if (!current || current.status !== BroadcastStatus.RUNNING) {
          return;
        }

        const contact = await this.contactRepository.findByIdForWorkspace(
          workspaceId,
          recipient.contactId.toString(),
        );
        if (!contact) {
          await this.recipientRepository.markFailed(
            recipient._id.toString(),
            "Contact no longer exists",
          );
          continue;
        }

        try {
          const message = await this.messageService.sendTemplate(
            workspaceId,
            broadcast.phoneNumberId.toString(),
            broadcast.createdBy,
            {
              to: contact.phoneNumber,
              templateId: broadcast.templateId.toString(),
              bodyParameters: broadcast.bodyParameters,
            },
            broadcastId,
          );
          await this.recipientRepository.markSent(recipient._id.toString(), message.id);
        } catch (error) {
          await this.recipientRepository.markFailed(
            recipient._id.toString(),
            error instanceof Error ? error.message : "Unknown error",
          );
        }

        await sleep(BROADCAST_SEND_DELAY_MS);
      }
      batch = await this.recipientRepository.findPendingBatch(
        broadcastId,
        BROADCAST_RECIPIENT_BATCH_SIZE,
      );
    }

    const stats = await this.recipientRepository.getStats(broadcastId);
    await this.broadcastRepository.updateStatus(broadcastId, BroadcastStatus.COMPLETED, {
      completedAt: new Date(),
    });
    this.eventEmitter.emit(DomainEvent.BROADCAST_COMPLETED, {
      workspaceId,
      broadcastId,
      sentCount: stats.sent,
      failedCount: stats.failed,
      occurredAt: new Date().toISOString(),
    } satisfies BroadcastCompletedPayload);
    this.emitFinished(workspaceId, broadcastId, broadcast.campaignId, BroadcastStatus.COMPLETED);
  }

  /** See BroadcastFinishedPayload's doc comment — this is Campaign completion-detection's own signal, distinct from BROADCAST_COMPLETED. */
  private emitFinished(
    workspaceId: string,
    broadcastId: string,
    campaignId: BroadcastDocument["campaignId"],
    finalStatus: BroadcastStatus,
  ): void {
    this.eventEmitter.emit(DomainEvent.BROADCAST_FINISHED, {
      workspaceId,
      broadcastId,
      campaignId: campaignId ? campaignId.toString() : null,
      finalStatus,
      occurredAt: new Date().toISOString(),
    } satisfies BroadcastFinishedPayload);
  }

  private async findOrThrow(workspaceId: string, id: string) {
    const broadcast = await this.broadcastRepository.findByIdForWorkspace(workspaceId, id);
    if (!broadcast) {
      throw new NotFoundException("Broadcast not found");
    }
    return broadcast;
  }
}
