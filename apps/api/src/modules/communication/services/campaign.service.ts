import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  BroadcastFinishedPayload,
  CampaignCancelledPayload,
  CampaignCompletedPayload,
} from "../../../common/events/domain-events.js";
import { CampaignRepository } from "../repositories/campaign.repository.js";
import { BroadcastRepository } from "../repositories/broadcast.repository.js";
import { BroadcastRecipientRepository } from "../repositories/broadcast-recipient.repository.js";
import { PhoneNumberRepository } from "../repositories/phone-number.repository.js";
import { ContactRepository } from "../repositories/contact.repository.js";
import { BroadcastService } from "./broadcast.service.js";
import { toBroadcastSummary, toCampaignSummary } from "../mappers/communication.mapper.js";
import type {
  BroadcastSummary,
  CampaignStatsSummary,
  CampaignSummary,
} from "../communication.types.js";
import type { CreateCampaignDto } from "../dto/create-campaign.dto.js";
import { CampaignStatus } from "../schemas/campaign.schema.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

/**
 * Campaign lifecycle (PRD-003 Part 3b-ii) — a container orchestrating
 * multiple Broadcasts ("waves") sent to one shared audience over a
 * timeline. Owns no send mechanics of its own; every wave is created via
 * BroadcastService.create() and reuses that module's entire execution
 * pipeline unchanged. See docs/COMM-CAMPAIGN-LIFECYCLE.md.
 *
 * Depends on BroadcastService (to create/cancel waves) but is never
 * depended on *by* BroadcastService — completion detection instead listens
 * for the BROADCAST_FINISHED domain event BroadcastService already emits,
 * specifically to avoid a circular dependency between the two services.
 */
@Injectable()
export class CampaignService {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly broadcastRepository: BroadcastRepository,
    private readonly recipientRepository: BroadcastRecipientRepository,
    private readonly phoneNumberRepository: PhoneNumberRepository,
    private readonly contactRepository: ContactRepository,
    private readonly broadcastService: BroadcastService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {}

  async create(
    workspaceId: string,
    createdBy: string,
    dto: CreateCampaignDto,
  ): Promise<CampaignSummary> {
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

    const campaign = await this.campaignRepository.create({
      workspaceId,
      name: dto.name,
      phoneNumberId: dto.phoneNumberId,
      targetContactIds: uniqueContactIds,
      createdBy,
    });
    const campaignId = campaign._id.toString();

    // Each wave is a real, independent Broadcast — created through
    // BroadcastService.create() so it gets the exact same validation,
    // BroadcastRecipient fan-out, and scheduling (every wave here always
    // has a scheduledAt, so each is created SCHEDULED, never DRAFT).
    for (const wave of dto.waves) {
      await this.broadcastService.create(
        workspaceId,
        createdBy,
        {
          name: wave.name,
          templateId: wave.templateId,
          phoneNumberId: dto.phoneNumberId,
          targetContactIds: uniqueContactIds,
          bodyParameters: wave.bodyParameters,
          scheduledAt: wave.scheduledAt,
        },
        campaignId,
      );
    }

    this.metricsService.communicationCampaignsTotal.inc({ status: CampaignStatus.ACTIVE });
    return toCampaignSummary(campaign);
  }

  async list(workspaceId: string): Promise<CampaignSummary[]> {
    const campaigns = await this.campaignRepository.findByWorkspace(workspaceId);
    return campaigns.map(toCampaignSummary);
  }

  async getById(workspaceId: string, id: string): Promise<CampaignSummary> {
    const campaign = await this.findOrThrow(workspaceId, id);
    return toCampaignSummary(campaign);
  }

  async listWaves(workspaceId: string, id: string): Promise<BroadcastSummary[]> {
    await this.findOrThrow(workspaceId, id);
    const waves = await this.broadcastRepository.findByCampaign(workspaceId, id);
    return waves.map(toBroadcastSummary);
  }

  /** Rollup of every wave's send-attempt stats — Layer 1 only, per docs/ADR-COMM-007. */
  async getStats(workspaceId: string, id: string): Promise<CampaignStatsSummary> {
    await this.findOrThrow(workspaceId, id);
    const waves = await this.broadcastRepository.findByCampaign(workspaceId, id);
    const perWaveStats = await Promise.all(
      waves.map((wave) => this.recipientRepository.getStats(wave._id.toString())),
    );

    const rollup = perWaveStats.reduce(
      (acc, stats) => ({
        pending: acc.pending + stats.pending,
        sent: acc.sent + stats.sent,
        failed: acc.failed + stats.failed,
        total: acc.total + stats.total,
      }),
      { pending: 0, sent: 0, failed: 0, total: 0 },
    );

    return { ...rollup, waveCount: waves.length };
  }

  /**
   * Cancels the Campaign first (before touching any wave) so the
   * BROADCAST_FINISHED handler below — which fires synchronously as each
   * wave is cancelled — sees status already CANCELLED and never mistakes
   * this cascade for the campaign naturally finishing all its waves.
   */
  async cancel(workspaceId: string, id: string, actorId: string): Promise<CampaignSummary> {
    const campaign = await this.findOrThrow(workspaceId, id);
    if (campaign.status !== CampaignStatus.ACTIVE) {
      throw new BadRequestException(
        `Only an ACTIVE campaign can be cancelled (current status: ${campaign.status})`,
      );
    }

    const updated = await this.campaignRepository.updateStatus(id, CampaignStatus.CANCELLED);
    this.metricsService.communicationCampaignsTotal.inc({ status: CampaignStatus.CANCELLED });
    this.eventEmitter.emit(DomainEvent.CAMPAIGN_CANCELLED, {
      workspaceId,
      campaignId: id,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies CampaignCancelledPayload);

    const waves = await this.broadcastRepository.findByCampaign(workspaceId, id);
    for (const wave of waves) {
      try {
        await this.broadcastService.cancel(workspaceId, wave._id.toString());
      } catch {
        // Already terminal (COMPLETED/CANCELLED/FAILED) — nothing to do,
        // not an error worth surfacing for a cascade.
      }
    }

    return toCampaignSummary(updated!);
  }

  /**
   * A Campaign completes once every one of its waves has reached a terminal
   * state — detected reactively via the event each wave's own terminal
   * transition already emits, rather than the Campaign polling its waves.
   */
  @OnEvent(DomainEvent.BROADCAST_FINISHED)
  async onBroadcastFinished(payload: BroadcastFinishedPayload): Promise<void> {
    if (!payload.campaignId) {
      return;
    }
    const campaign = await this.campaignRepository.findByIdForWorkspace(
      payload.workspaceId,
      payload.campaignId,
    );
    // Not ACTIVE means already CANCELLED (or, in principle, already
    // COMPLETED) — either way, this event must not re-decide the outcome.
    if (!campaign || campaign.status !== CampaignStatus.ACTIVE) {
      return;
    }

    const activeWaveCount = await this.broadcastRepository.countActiveByCampaign(
      payload.workspaceId,
      payload.campaignId,
    );
    if (activeWaveCount > 0) {
      return;
    }

    await this.campaignRepository.updateStatus(payload.campaignId, CampaignStatus.COMPLETED, {
      completedAt: new Date(),
    });
    this.metricsService.communicationCampaignsTotal.inc({ status: CampaignStatus.COMPLETED });
    this.eventEmitter.emit(DomainEvent.CAMPAIGN_COMPLETED, {
      workspaceId: payload.workspaceId,
      campaignId: payload.campaignId,
      occurredAt: new Date().toISOString(),
    } satisfies CampaignCompletedPayload);
  }

  private async findOrThrow(workspaceId: string, id: string) {
    const campaign = await this.campaignRepository.findByIdForWorkspace(workspaceId, id);
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
    return campaign;
  }
}
