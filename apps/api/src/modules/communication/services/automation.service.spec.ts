import { Test } from "@nestjs/testing";
import { AutomationService } from "./automation.service.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { AutomationSettingsRepository } from "../repositories/automation-settings.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { MessageService } from "./message.service.js";
import { ConversationStatus } from "../schemas/conversation.schema.js";
import type { BusinessHours } from "../../workspace/schemas/workspace.schema.js";

describe("AutomationService", () => {
  let service: AutomationService;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let automationSettingsRepository: jest.Mocked<AutomationSettingsRepository>;
  let conversationRepository: jest.Mocked<ConversationRepository>;
  let messageService: jest.Mocked<MessageService>;

  // A fixed "always open" schedule so tests don't depend on real wall-clock time.
  const alwaysOpenBusinessHours: BusinessHours = {
    timezone: "UTC",
    schedule: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      isOpen: true,
      openTime: "00:00",
      closeTime: "23:59",
    })),
    publicHolidays: [],
  };

  const newConversation = {
    _id: { toString: () => "conversation-1" },
    status: ConversationStatus.NEW,
    welcomeLastSentAt: null,
    awayLastSentAt: null,
  };

  const openConversation = {
    _id: { toString: () => "conversation-1" },
    status: ConversationStatus.OPEN,
    welcomeLastSentAt: null,
    awayLastSentAt: null,
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AutomationService,
        { provide: WorkspaceRepository, useValue: { findById: jest.fn() } },
        {
          provide: AutomationSettingsRepository,
          useValue: { findOrDefault: jest.fn(), upsert: jest.fn() },
        },
        {
          provide: ConversationRepository,
          useValue: { updateWelcomeLastSentAt: jest.fn(), updateAwayLastSentAt: jest.fn() },
        },
        { provide: MessageService, useValue: { sendText: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(AutomationService);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    automationSettingsRepository = moduleRef.get(AutomationSettingsRepository);
    conversationRepository = moduleRef.get(ConversationRepository);
    messageService = moduleRef.get(MessageService);
  });

  describe("maybeSendAutoReply — Welcome", () => {
    it("sends the Welcome message on a NEW conversation when enabled", async () => {
      automationSettingsRepository.findOrDefault.mockResolvedValue({
        workspaceId: "workspace-1",
        welcomeMessageEnabled: true,
        welcomeMessageText: "Hi! Thanks for reaching out.",
        awayMessageEnabled: false,
        awayMessageText: null,
      });

      await service.maybeSendAutoReply(
        "workspace-1",
        newConversation as never,
        "phone-1",
        "+919876543210",
      );

      expect(messageService.sendText).toHaveBeenCalledWith("workspace-1", "phone-1", "SYSTEM", {
        to: "+919876543210",
        text: "Hi! Thanks for reaching out.",
      });
      expect(conversationRepository.updateWelcomeLastSentAt).toHaveBeenCalledWith(
        "conversation-1",
        expect.any(Date) as Date,
      );
      // Welcome doesn't need business hours at all — never looked up.
      expect(workspaceRepository.findById).not.toHaveBeenCalled();
    });

    it("does not send Welcome when disabled", async () => {
      automationSettingsRepository.findOrDefault.mockResolvedValue({
        workspaceId: "workspace-1",
        welcomeMessageEnabled: false,
        welcomeMessageText: "Hi!",
        awayMessageEnabled: false,
        awayMessageText: null,
      });

      await service.maybeSendAutoReply(
        "workspace-1",
        newConversation as never,
        "phone-1",
        "+919876543210",
      );

      expect(messageService.sendText).not.toHaveBeenCalled();
    });

    it("does not send Welcome when enabled but no text is configured", async () => {
      automationSettingsRepository.findOrDefault.mockResolvedValue({
        workspaceId: "workspace-1",
        welcomeMessageEnabled: true,
        welcomeMessageText: null,
        awayMessageEnabled: false,
        awayMessageText: null,
      });

      await service.maybeSendAutoReply(
        "workspace-1",
        newConversation as never,
        "phone-1",
        "+919876543210",
      );

      expect(messageService.sendText).not.toHaveBeenCalled();
    });
  });

  describe("maybeSendAutoReply — Away", () => {
    it("sends the Away message on a non-NEW conversation outside business hours", async () => {
      automationSettingsRepository.findOrDefault.mockResolvedValue({
        workspaceId: "workspace-1",
        welcomeMessageEnabled: false,
        welcomeMessageText: null,
        awayMessageEnabled: true,
        awayMessageText: "We're away right now.",
      });
      workspaceRepository.findById.mockResolvedValue({
        businessHours: {
          timezone: "UTC",
          schedule: [], // no schedule entries at all => never "open"
          publicHolidays: [],
        },
      } as never);

      await service.maybeSendAutoReply(
        "workspace-1",
        openConversation as never,
        "phone-1",
        "+919876543210",
      );

      expect(messageService.sendText).toHaveBeenCalledWith("workspace-1", "phone-1", "SYSTEM", {
        to: "+919876543210",
        text: "We're away right now.",
      });
      expect(conversationRepository.updateAwayLastSentAt).toHaveBeenCalledWith(
        "conversation-1",
        expect.any(Date) as Date,
      );
    });

    it("does not send Away during business hours", async () => {
      automationSettingsRepository.findOrDefault.mockResolvedValue({
        workspaceId: "workspace-1",
        welcomeMessageEnabled: false,
        welcomeMessageText: null,
        awayMessageEnabled: true,
        awayMessageText: "We're away right now.",
      });
      workspaceRepository.findById.mockResolvedValue({
        businessHours: alwaysOpenBusinessHours,
      } as never);

      await service.maybeSendAutoReply(
        "workspace-1",
        openConversation as never,
        "phone-1",
        "+919876543210",
      );

      expect(messageService.sendText).not.toHaveBeenCalled();
    });

    it("does not look up Business Hours at all when Away is disabled", async () => {
      automationSettingsRepository.findOrDefault.mockResolvedValue({
        workspaceId: "workspace-1",
        welcomeMessageEnabled: false,
        welcomeMessageText: null,
        awayMessageEnabled: false,
        awayMessageText: null,
      });

      await service.maybeSendAutoReply(
        "workspace-1",
        openConversation as never,
        "phone-1",
        "+919876543210",
      );

      expect(workspaceRepository.findById).not.toHaveBeenCalled();
      expect(messageService.sendText).not.toHaveBeenCalled();
    });
  });

  describe("maybeSendAutoReply — cooldown and error handling", () => {
    it("does not send Welcome within its own cooldown window", async () => {
      const recentlyWelcomed = {
        _id: { toString: () => "conversation-1" },
        status: ConversationStatus.NEW,
        welcomeLastSentAt: new Date(), // just now
        awayLastSentAt: null,
      };

      await service.maybeSendAutoReply(
        "workspace-1",
        recentlyWelcomed as never,
        "phone-1",
        "+919876543210",
      );

      expect(automationSettingsRepository.findOrDefault).not.toHaveBeenCalled();
      expect(messageService.sendText).not.toHaveBeenCalled();
    });

    it("does not send Away within its own cooldown window", async () => {
      const recentlyAwayed = {
        _id: { toString: () => "conversation-1" },
        status: ConversationStatus.OPEN,
        welcomeLastSentAt: null,
        awayLastSentAt: new Date(), // just now
      };

      await service.maybeSendAutoReply(
        "workspace-1",
        recentlyAwayed as never,
        "phone-1",
        "+919876543210",
      );

      expect(automationSettingsRepository.findOrDefault).not.toHaveBeenCalled();
      expect(messageService.sendText).not.toHaveBeenCalled();
    });

    it("sends Away even when Welcome just fired on the same conversation (independent cooldowns)", async () => {
      automationSettingsRepository.findOrDefault.mockResolvedValue({
        workspaceId: "workspace-1",
        welcomeMessageEnabled: true,
        welcomeMessageText: "Hi!",
        awayMessageEnabled: true,
        awayMessageText: "We're away right now.",
      });
      workspaceRepository.findById.mockResolvedValue({
        businessHours: { timezone: "UTC", schedule: [], publicHolidays: [] },
      } as never);
      const justWelcomed = {
        _id: { toString: () => "conversation-1" },
        status: ConversationStatus.OPEN,
        welcomeLastSentAt: new Date(), // fired moments ago on this same conversation
        awayLastSentAt: null,
      };

      await service.maybeSendAutoReply(
        "workspace-1",
        justWelcomed as never,
        "phone-1",
        "+919876543210",
      );

      expect(messageService.sendText).toHaveBeenCalledWith("workspace-1", "phone-1", "SYSTEM", {
        to: "+919876543210",
        text: "We're away right now.",
      });
    });

    it("never throws, even if the underlying send fails", async () => {
      automationSettingsRepository.findOrDefault.mockResolvedValue({
        workspaceId: "workspace-1",
        welcomeMessageEnabled: true,
        welcomeMessageText: "Hi!",
        awayMessageEnabled: false,
        awayMessageText: null,
      });
      messageService.sendText.mockRejectedValue(new Error("Meta rejected the send"));

      await expect(
        service.maybeSendAutoReply(
          "workspace-1",
          newConversation as never,
          "phone-1",
          "+919876543210",
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe("getSettings / updateSettings", () => {
    it("returns defaults when nothing has been configured yet", async () => {
      automationSettingsRepository.findOrDefault.mockResolvedValue({
        workspaceId: "workspace-1",
        welcomeMessageEnabled: false,
        welcomeMessageText: null,
        awayMessageEnabled: false,
        awayMessageText: null,
      });

      const result = await service.getSettings("workspace-1");
      expect(result).toEqual({
        welcomeMessageEnabled: false,
        welcomeMessageText: null,
        awayMessageEnabled: false,
        awayMessageText: null,
        updatedAt: null,
      });
    });

    it("upserts and returns the updated settings", async () => {
      automationSettingsRepository.upsert.mockResolvedValue({
        welcomeMessageEnabled: true,
        welcomeMessageText: "Hi!",
        awayMessageEnabled: false,
        awayMessageText: null,
        updatedAt: new Date("2026-08-05T00:00:00.000Z"),
      } as never);

      const result = await service.updateSettings(
        "workspace-1",
        { welcomeMessageEnabled: true, welcomeMessageText: "Hi!" },
        "user-1",
      );

      expect(automationSettingsRepository.upsert).toHaveBeenCalledWith(
        "workspace-1",
        { welcomeMessageEnabled: true, welcomeMessageText: "Hi!" },
        "user-1",
      );
      expect(result.welcomeMessageEnabled).toBe(true);
      expect(result.updatedAt).toBe("2026-08-05T00:00:00.000Z");
    });
  });
});
