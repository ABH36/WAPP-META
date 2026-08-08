import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  DomainEvent,
  GlobalAnnouncementCreatedPayload,
} from "../../../common/events/domain-events.js";
import {
  CreatePlatformAnnouncementInput,
  PlatformAnnouncementRepository,
} from "../repositories/platform-announcement.repository.js";
import { toPlatformAnnouncementSummary } from "../mappers/platform.mapper.js";
import type { PlatformAnnouncementSummary } from "../platform.types.js";

/** PRD-007 Volume-1 §4.4 — creation + platform-side listing only this volume (§9's literal API surface has no tenant-facing display endpoint). */
@Injectable()
export class PlatformAnnouncementsService {
  constructor(
    private readonly platformAnnouncementRepository: PlatformAnnouncementRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    input: Omit<CreatePlatformAnnouncementInput, "createdBy"> & { createdBy: string },
  ): Promise<PlatformAnnouncementSummary> {
    const announcement = await this.platformAnnouncementRepository.create(input);

    const payload: GlobalAnnouncementCreatedPayload = {
      announcementId: announcement._id.toString(),
      targetType: announcement.targetType,
      actorId: input.createdBy,
      occurredAt: new Date().toISOString(),
    };
    this.eventEmitter.emit(DomainEvent.GLOBAL_ANNOUNCEMENT_CREATED, payload);

    return toPlatformAnnouncementSummary(announcement);
  }

  async list(): Promise<PlatformAnnouncementSummary[]> {
    const announcements = await this.platformAnnouncementRepository.findAll();
    return announcements.map(toPlatformAnnouncementSummary);
  }
}
