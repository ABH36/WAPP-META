import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CampaignService } from "./campaign.service.js";
import { CampaignRepository } from "../repositories/campaign.repository.js";
import { BroadcastRepository } from "../repositories/broadcast.repository.js";
import { BroadcastRecipientRepository } from "../repositories/broadcast-recipient.repository.js";
import { PhoneNumberRepository } from "../repositories/phone-number.repository.js";
import { ContactRepository } from "../repositories/contact.repository.js";
import { BroadcastService } from "./broadcast.service.js";
import { CampaignStatus } from "../schemas/campaign.schema.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

describe("CampaignService", () => {
  let service: CampaignService;
  let campaignRepository: jest.Mocked<CampaignRepository>;
  let broadcastRepository: jest.Mocked<BroadcastRepository>;
  let recipientRepository: jest.Mocked<BroadcastRecipientRepository>;
  let phoneNumberRepository: jest.Mocked<PhoneNumberRepository>;
  let contactRepository: jest.Mocked<ContactRepository>;
  let broadcastService: jest.Mocked<BroadcastService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const baseCampaign = {
    _id: { toString: () => "campaign-1" },
    workspaceId: "workspace-1",
    name: "Diwali Sale",
    phoneNumberId: { toString: () => "phone-1" },
    targetContactIds: ["contact-1", "contact-2"],
    status: CampaignStatus.ACTIVE,
    completedAt: null,
    createdBy: "user-1",
    createdAt: new Date("2026-08-05T00:00:00.000Z"),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CampaignService,
        {
          provide: CampaignRepository,
          useValue: {
            create: jest.fn(),
            findByIdForWorkspace: jest.fn(),
            findByWorkspace: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: BroadcastRepository,
          useValue: { findByCampaign: jest.fn(), countActiveByCampaign: jest.fn() },
        },
        { provide: BroadcastRecipientRepository, useValue: { getStats: jest.fn() } },
        { provide: PhoneNumberRepository, useValue: { findByIdForWorkspace: jest.fn() } },
        { provide: ContactRepository, useValue: { findByIdsForWorkspace: jest.fn() } },
        { provide: BroadcastService, useValue: { create: jest.fn(), cancel: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        MetricsService,
      ],
    }).compile();

    service = moduleRef.get(CampaignService);
    campaignRepository = moduleRef.get(CampaignRepository);
    broadcastRepository = moduleRef.get(BroadcastRepository);
    recipientRepository = moduleRef.get(BroadcastRecipientRepository);
    phoneNumberRepository = moduleRef.get(PhoneNumberRepository);
    contactRepository = moduleRef.get(ContactRepository);
    broadcastService = moduleRef.get(BroadcastService);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("create", () => {
    it("throws when the phone number doesn't belong to the workspace", async () => {
      phoneNumberRepository.findByIdForWorkspace.mockResolvedValue(null);

      await expect(
        service.create("workspace-1", "user-1", {
          name: "Diwali Sale",
          phoneNumberId: "phone-1",
          targetContactIds: ["contact-1"],
          waves: [
            {
              name: "Wave 1",
              templateId: "template-1",
              bodyParameters: [],
              scheduledAt: new Date(),
            },
          ],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws when a target Contact doesn't belong to the workspace", async () => {
      phoneNumberRepository.findByIdForWorkspace.mockResolvedValue({} as never);
      contactRepository.findByIdsForWorkspace.mockResolvedValue([{ _id: "contact-1" } as never]);

      await expect(
        service.create("workspace-1", "user-1", {
          name: "Diwali Sale",
          phoneNumberId: "phone-1",
          targetContactIds: ["contact-1", "contact-2"],
          waves: [
            {
              name: "Wave 1",
              templateId: "template-1",
              bodyParameters: [],
              scheduledAt: new Date(),
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates the Campaign, then creates one Broadcast per wave tagged with the campaign id", async () => {
      phoneNumberRepository.findByIdForWorkspace.mockResolvedValue({} as never);
      contactRepository.findByIdsForWorkspace.mockResolvedValue([
        { _id: "contact-1" } as never,
        { _id: "contact-2" } as never,
      ]);
      campaignRepository.create.mockResolvedValue(baseCampaign as never);
      broadcastService.create.mockResolvedValue({ id: "broadcast-1" } as never);

      const wave1ScheduledAt = new Date("2026-08-10T00:00:00.000Z");
      const wave2ScheduledAt = new Date("2026-08-12T00:00:00.000Z");
      const result = await service.create("workspace-1", "user-1", {
        name: "Diwali Sale",
        phoneNumberId: "phone-1",
        targetContactIds: ["contact-1", "contact-2"],
        waves: [
          {
            name: "Announcement",
            templateId: "template-1",
            bodyParameters: [],
            scheduledAt: wave1ScheduledAt,
          },
          {
            name: "Reminder",
            templateId: "template-2",
            bodyParameters: [],
            scheduledAt: wave2ScheduledAt,
          },
        ],
      });

      expect(result.id).toBe("campaign-1");
      expect(broadcastService.create).toHaveBeenCalledTimes(2);
      expect(broadcastService.create).toHaveBeenNthCalledWith(
        1,
        "workspace-1",
        "user-1",
        expect.objectContaining({
          name: "Announcement",
          templateId: "template-1",
          targetContactIds: ["contact-1", "contact-2"],
          scheduledAt: wave1ScheduledAt,
        }),
        "campaign-1",
      );
      expect(broadcastService.create).toHaveBeenNthCalledWith(
        2,
        "workspace-1",
        "user-1",
        expect.objectContaining({ name: "Reminder", scheduledAt: wave2ScheduledAt }),
        "campaign-1",
      );
    });
  });

  describe("cancel", () => {
    it("rejects a campaign that isn't ACTIVE", async () => {
      campaignRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseCampaign,
        status: CampaignStatus.COMPLETED,
      } as never);

      await expect(service.cancel("workspace-1", "campaign-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("cancels the Campaign before cascading to waves, and tolerates already-terminal waves", async () => {
      campaignRepository.findByIdForWorkspace.mockResolvedValue(baseCampaign as never);
      campaignRepository.updateStatus.mockResolvedValue({
        ...baseCampaign,
        status: CampaignStatus.CANCELLED,
      } as never);
      broadcastRepository.findByCampaign.mockResolvedValue([
        { _id: { toString: () => "broadcast-1" } } as never,
        { _id: { toString: () => "broadcast-2" } } as never,
      ]);
      broadcastService.cancel
        .mockResolvedValueOnce({} as never)
        .mockRejectedValueOnce(new BadRequestException("Broadcast is already COMPLETED"));

      const result = await service.cancel("workspace-1", "campaign-1", "user-1");

      expect(campaignRepository.updateStatus).toHaveBeenCalledWith(
        "campaign-1",
        CampaignStatus.CANCELLED,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "communication.campaign_cancelled",
        expect.objectContaining({ campaignId: "campaign-1", actorId: "user-1" }),
      );
      expect(broadcastService.cancel).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(CampaignStatus.CANCELLED);
    });
  });

  describe("getStats", () => {
    it("sums per-wave stats into a rollup", async () => {
      campaignRepository.findByIdForWorkspace.mockResolvedValue(baseCampaign as never);
      broadcastRepository.findByCampaign.mockResolvedValue([
        { _id: { toString: () => "broadcast-1" } } as never,
        { _id: { toString: () => "broadcast-2" } } as never,
      ]);
      recipientRepository.getStats
        .mockResolvedValueOnce({ pending: 0, sent: 2, failed: 0, total: 2 })
        .mockResolvedValueOnce({ pending: 1, sent: 0, failed: 1, total: 2 });

      const stats = await service.getStats("workspace-1", "campaign-1");

      expect(stats).toEqual({ waveCount: 2, pending: 1, sent: 2, failed: 1, total: 4 });
    });
  });

  describe("onBroadcastFinished", () => {
    it("ignores a Broadcast with no campaignId", async () => {
      await service.onBroadcastFinished({
        workspaceId: "workspace-1",
        broadcastId: "broadcast-1",
        campaignId: null,
        finalStatus: "COMPLETED",
        occurredAt: new Date().toISOString(),
      });
      expect(campaignRepository.findByIdForWorkspace).not.toHaveBeenCalled();
    });

    it("does nothing if the campaign is no longer ACTIVE (already cancelled)", async () => {
      campaignRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseCampaign,
        status: CampaignStatus.CANCELLED,
      } as never);

      await service.onBroadcastFinished({
        workspaceId: "workspace-1",
        broadcastId: "broadcast-1",
        campaignId: "campaign-1",
        finalStatus: "CANCELLED",
        occurredAt: new Date().toISOString(),
      });

      expect(broadcastRepository.countActiveByCampaign).not.toHaveBeenCalled();
      expect(campaignRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("does nothing if other waves are still active", async () => {
      campaignRepository.findByIdForWorkspace.mockResolvedValue(baseCampaign as never);
      broadcastRepository.countActiveByCampaign.mockResolvedValue(1);

      await service.onBroadcastFinished({
        workspaceId: "workspace-1",
        broadcastId: "broadcast-1",
        campaignId: "campaign-1",
        finalStatus: "COMPLETED",
        occurredAt: new Date().toISOString(),
      });

      expect(campaignRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("marks the Campaign COMPLETED and emits CAMPAIGN_COMPLETED once every wave is terminal", async () => {
      campaignRepository.findByIdForWorkspace.mockResolvedValue(baseCampaign as never);
      broadcastRepository.countActiveByCampaign.mockResolvedValue(0);
      campaignRepository.updateStatus.mockResolvedValue({
        ...baseCampaign,
        status: CampaignStatus.COMPLETED,
      } as never);

      await service.onBroadcastFinished({
        workspaceId: "workspace-1",
        broadcastId: "broadcast-2",
        campaignId: "campaign-1",
        finalStatus: "COMPLETED",
        occurredAt: new Date().toISOString(),
      });

      const [, , completeExtra] = campaignRepository.updateStatus.mock.calls[0]!;
      expect(completeExtra?.completedAt).toBeInstanceOf(Date);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "communication.campaign_completed",
        expect.objectContaining({ campaignId: "campaign-1" }),
      );
    });
  });
});
