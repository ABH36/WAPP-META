import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TenantRole, WorkspaceMemberStatus } from "@wapp/shared-types";
import { ConversationService } from "./conversation.service.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { ConversationNoteRepository } from "../repositories/conversation-note.repository.js";
import { ContactRepository } from "../repositories/contact.repository.js";
import { MessageRepository } from "../repositories/message.repository.js";
import { MessageService } from "./message.service.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { ConversationStatus } from "../schemas/conversation.schema.js";

describe("ConversationService", () => {
  let service: ConversationService;
  let conversationRepository: jest.Mocked<ConversationRepository>;
  let conversationNoteRepository: jest.Mocked<ConversationNoteRepository>;
  let contactRepository: jest.Mocked<ContactRepository>;
  let messageService: jest.Mocked<MessageService>;
  let userRepository: jest.Mocked<UserRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const baseConversation = {
    _id: { toString: () => "conversation-1" },
    workspaceId: "workspace-1",
    contactId: { toString: () => "contact-1" },
    phoneNumberId: { toString: () => "phone-1" },
    status: ConversationStatus.NEW,
    assignedToUserId: null,
    lastMessageAt: new Date("2026-08-01T00:00:00.000Z"),
    resolvedAt: null,
    closedAt: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        {
          provide: ConversationRepository,
          useValue: {
            list: jest.fn(),
            findById: jest.fn(),
            updateStatus: jest.fn(),
            assign: jest.fn(),
            findResolvedBefore: jest.fn(),
          },
        },
        {
          provide: ConversationNoteRepository,
          useValue: { create: jest.fn(), findByConversation: jest.fn() },
        },
        { provide: ContactRepository, useValue: { findByIdForWorkspace: jest.fn() } },
        { provide: MessageRepository, useValue: { findByConversation: jest.fn() } },
        { provide: MessageService, useValue: { sendText: jest.fn() } },
        { provide: UserRepository, useValue: { findById: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(ConversationService);
    conversationRepository = moduleRef.get(ConversationRepository);
    conversationNoteRepository = moduleRef.get(ConversationNoteRepository);
    contactRepository = moduleRef.get(ContactRepository);
    messageService = moduleRef.get(MessageService);
    userRepository = moduleRef.get(UserRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("list", () => {
    it("returns items with pagination meta", async () => {
      conversationRepository.list.mockResolvedValue({
        items: [baseConversation as never],
        total: 1,
      });

      const result = await service.list("workspace-1", {});

      expect(result.items).toHaveLength(1);
      expect(result.meta).toEqual(
        expect.objectContaining({ page: 1, pageSize: 25, totalRecords: 1, totalPages: 1 }),
      );
    });
  });

  describe("reply", () => {
    it("resolves the contact's phone number and delegates to MessageService", async () => {
      conversationRepository.findById.mockResolvedValue(baseConversation as never);
      contactRepository.findByIdForWorkspace.mockResolvedValue({
        phoneNumber: "+919876543210",
      } as never);
      messageService.sendText.mockResolvedValue({ id: "message-1" } as never);

      await service.reply("workspace-1", "conversation-1", "user-1", "Hello");

      expect(messageService.sendText).toHaveBeenCalledWith("workspace-1", "phone-1", "user-1", {
        to: "+919876543210",
        text: "Hello",
      });
    });

    it("throws NotFoundException for a conversation outside the workspace", async () => {
      conversationRepository.findById.mockResolvedValue(null);
      await expect(service.reply("workspace-1", "nope", "user-1", "Hi")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateStatus", () => {
    it("rejects manually setting NEW", async () => {
      await expect(
        service.updateStatus("workspace-1", "conversation-1", ConversationStatus.NEW, "user-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("updates status and emits CONVERSATION_STATUS_CHANGED", async () => {
      conversationRepository.findById.mockResolvedValue(baseConversation as never);
      conversationRepository.updateStatus.mockResolvedValue({
        ...baseConversation,
        status: ConversationStatus.RESOLVED,
      } as never);

      await service.updateStatus(
        "workspace-1",
        "conversation-1",
        ConversationStatus.RESOLVED,
        "user-1",
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "communication.conversation_status_changed",
        expect.objectContaining({
          previousStatus: ConversationStatus.NEW,
          newStatus: ConversationStatus.RESOLVED,
          actorId: "user-1",
        }),
      );
    });
  });

  describe("assign", () => {
    it("rejects an assignee who isn't an active member of the workspace", async () => {
      conversationRepository.findById.mockResolvedValue(baseConversation as never);
      userRepository.findById.mockResolvedValue({
        workspaceId: "workspace-1",
        workspaceMemberStatus: WorkspaceMemberStatus.SUSPENDED,
        role: TenantRole.SALES_EXECUTIVE,
      } as never);

      await expect(
        service.assign("workspace-1", "conversation-1", "user-2", "user-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects an assignee whose role has no Shared Inbox access", async () => {
      conversationRepository.findById.mockResolvedValue(baseConversation as never);
      userRepository.findById.mockResolvedValue({
        workspaceId: "workspace-1",
        workspaceMemberStatus: WorkspaceMemberStatus.ACTIVE,
        role: TenantRole.MARKETING_EXECUTIVE,
      } as never);

      await expect(
        service.assign("workspace-1", "conversation-1", "user-2", "user-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("promotes NEW to ASSIGNED when assigning a valid member", async () => {
      conversationRepository.findById.mockResolvedValue(baseConversation as never);
      userRepository.findById.mockResolvedValue({
        workspaceId: "workspace-1",
        workspaceMemberStatus: WorkspaceMemberStatus.ACTIVE,
        role: TenantRole.SALES_EXECUTIVE,
      } as never);
      conversationRepository.assign.mockResolvedValue({
        ...baseConversation,
        status: ConversationStatus.ASSIGNED,
        assignedToUserId: "user-2",
      } as never);

      await service.assign("workspace-1", "conversation-1", "user-2", "user-1");

      expect(conversationRepository.assign).toHaveBeenCalledWith(
        "workspace-1",
        "conversation-1",
        "user-2",
        ConversationStatus.ASSIGNED,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "communication.conversation_assigned",
        expect.objectContaining({ assignedToUserId: "user-2", actorId: "user-1" }),
      );
    });

    it("demotes ASSIGNED to OPEN when unassigning", async () => {
      conversationRepository.findById.mockResolvedValue({
        ...baseConversation,
        status: ConversationStatus.ASSIGNED,
        assignedToUserId: "user-2",
      } as never);
      conversationRepository.assign.mockResolvedValue({
        ...baseConversation,
        status: ConversationStatus.OPEN,
        assignedToUserId: null,
      } as never);

      await service.assign("workspace-1", "conversation-1", null, "user-1");

      expect(conversationRepository.assign).toHaveBeenCalledWith(
        "workspace-1",
        "conversation-1",
        null,
        ConversationStatus.OPEN,
      );
    });
  });

  describe("notes", () => {
    it("creates a note and emits CONVERSATION_NOTE_ADDED", async () => {
      conversationRepository.findById.mockResolvedValue(baseConversation as never);
      conversationNoteRepository.create.mockResolvedValue({
        _id: { toString: () => "note-1" },
        conversationId: { toString: () => "conversation-1" },
        authorUserId: "user-1",
        text: "Called customer back",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
      } as never);

      const result = await service.addNote(
        "workspace-1",
        "conversation-1",
        "user-1",
        "Called customer back",
      );

      expect(result.id).toBe("note-1");
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "communication.conversation_note_added",
        expect.objectContaining({ authorUserId: "user-1" }),
      );
    });
  });

  describe("autoCloseInactive", () => {
    it("closes every RESOLVED conversation past the cutoff and emits an event per conversation", async () => {
      conversationRepository.findResolvedBefore.mockResolvedValue([
        { ...baseConversation, status: ConversationStatus.RESOLVED } as never,
      ]);
      conversationRepository.updateStatus.mockResolvedValue({
        ...baseConversation,
        status: ConversationStatus.CLOSED,
      } as never);

      const count = await service.autoCloseInactive(new Date("2026-08-05T00:00:00.000Z"));

      expect(count).toBe(1);
      expect(conversationRepository.updateStatus).toHaveBeenCalledWith(
        "workspace-1",
        "conversation-1",
        ConversationStatus.CLOSED,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "communication.conversation_status_changed",
        expect.objectContaining({ actorId: "SYSTEM", newStatus: ConversationStatus.CLOSED }),
      );
    });
  });
});
