import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PlatformAnnouncementsService } from "./platform-announcements.service.js";
import { PlatformAnnouncementRepository } from "../repositories/platform-announcement.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import { AnnouncementTargetType } from "../schemas/platform-announcement.schema.js";

describe("PlatformAnnouncementsService", () => {
  let service: PlatformAnnouncementsService;
  let platformAnnouncementRepository: jest.Mocked<PlatformAnnouncementRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformAnnouncementsService,
        {
          provide: PlatformAnnouncementRepository,
          useValue: { create: jest.fn(), findAll: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformAnnouncementsService);
    platformAnnouncementRepository = moduleRef.get(PlatformAnnouncementRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  it("creates an announcement and emits GLOBAL_ANNOUNCEMENT_CREATED", async () => {
    platformAnnouncementRepository.create.mockResolvedValue({
      _id: { toString: () => "announcement-1" },
      title: "Scheduled downtime",
      message: "The platform will be briefly unavailable.",
      targetType: AnnouncementTargetType.ALL,
      targetPlanIds: [],
      targetWorkspaceIds: [],
      createdBy: "platform-user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    } as never);

    await service.create({
      title: "Scheduled downtime",
      message: "The platform will be briefly unavailable.",
      targetType: AnnouncementTargetType.ALL,
      targetPlanIds: [],
      targetWorkspaceIds: [],
      createdBy: "platform-user-1",
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.GLOBAL_ANNOUNCEMENT_CREATED,
      expect.objectContaining({
        announcementId: "announcement-1",
        targetType: AnnouncementTargetType.ALL,
        actorId: "platform-user-1",
      }),
    );
  });

  it("list() returns every announcement from the repository", async () => {
    platformAnnouncementRepository.findAll.mockResolvedValue([
      {
        _id: { toString: () => "announcement-1" },
        title: "A",
        message: "B",
        targetType: AnnouncementTargetType.ALL,
        targetPlanIds: [],
        targetWorkspaceIds: [],
        createdBy: "platform-user-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      } as never,
    ]);

    const result = await service.list();

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("A");
  });
});
