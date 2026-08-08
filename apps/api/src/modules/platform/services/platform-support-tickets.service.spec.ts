import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PlatformSupportTicketsService } from "./platform-support-tickets.service.js";
import { SupportTicketRepository } from "../repositories/support-ticket.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "../schemas/support-ticket.schema.js";

const baseTicket = {
  _id: { toString: () => "ticket-1" },
  workspaceId: "workspace-1",
  title: "Billing question",
  category: SupportTicketCategory.BILLING,
  priority: SupportTicketPriority.MEDIUM,
  status: SupportTicketStatus.OPEN,
  assignedOperator: null as string | null,
  resolution: null as string | null,
  createdBy: "op-1",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

describe("PlatformSupportTicketsService", () => {
  let service: PlatformSupportTicketsService;
  let supportTicketRepository: jest.Mocked<SupportTicketRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformSupportTicketsService,
        {
          provide: SupportTicketRepository,
          useValue: { create: jest.fn(), findById: jest.fn(), list: jest.fn(), update: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformSupportTicketsService);
    supportTicketRepository = moduleRef.get(SupportTicketRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("create", () => {
    it("creates a ticket and emits SUPPORT_TICKET_CREATED", async () => {
      supportTicketRepository.create.mockResolvedValue(baseTicket as never);

      const result = await service.create(
        "workspace-1",
        "Billing question",
        SupportTicketCategory.BILLING,
        SupportTicketPriority.MEDIUM,
        "op-1",
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.SUPPORT_TICKET_CREATED,
        expect.objectContaining({
          workspaceId: "workspace-1",
          ticketId: "ticket-1",
          category: SupportTicketCategory.BILLING,
          priority: SupportTicketPriority.MEDIUM,
          actorId: "op-1",
        }),
      );
      expect(result.status).toBe(SupportTicketStatus.OPEN);
    });
  });

  describe("update", () => {
    it("moves to RESOLVED with a resolution and emits SUPPORT_TICKET_RESOLVED", async () => {
      supportTicketRepository.findById.mockResolvedValue(baseTicket as never);
      supportTicketRepository.update.mockResolvedValue({
        ...baseTicket,
        status: SupportTicketStatus.RESOLVED,
        resolution: "Explained the charge",
      } as never);

      const result = await service.update(
        "ticket-1",
        { status: SupportTicketStatus.RESOLVED, resolution: "Explained the charge" },
        "op-1",
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.SUPPORT_TICKET_RESOLVED,
        expect.objectContaining({
          workspaceId: "workspace-1",
          ticketId: "ticket-1",
          actorId: "op-1",
        }),
      );
      expect(result.status).toBe(SupportTicketStatus.RESOLVED);
    });

    it("rejects resolving without a resolution", async () => {
      supportTicketRepository.findById.mockResolvedValue(baseTicket as never);

      await expect(
        service.update("ticket-1", { status: SupportTicketStatus.RESOLVED }, "op-1"),
      ).rejects.toThrow(BadRequestException);
      expect(supportTicketRepository.update).not.toHaveBeenCalled();
    });

    it("rejects modifying a CLOSED ticket", async () => {
      supportTicketRepository.findById.mockResolvedValue({
        ...baseTicket,
        status: SupportTicketStatus.CLOSED,
      } as never);

      await expect(
        service.update("ticket-1", { status: SupportTicketStatus.IN_PROGRESS }, "op-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("allows a status update that doesn't touch resolution without emitting SUPPORT_TICKET_RESOLVED", async () => {
      supportTicketRepository.findById.mockResolvedValue(baseTicket as never);
      supportTicketRepository.update.mockResolvedValue({
        ...baseTicket,
        status: SupportTicketStatus.IN_PROGRESS,
      } as never);

      await service.update("ticket-1", { status: SupportTicketStatus.IN_PROGRESS }, "op-1");

      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        DomainEvent.SUPPORT_TICKET_RESOLVED,
        expect.anything(),
      );
    });
  });

  describe("list", () => {
    it("returns mapped summaries", async () => {
      supportTicketRepository.list.mockResolvedValue([baseTicket as never]);

      const result = await service.list({ workspaceId: "workspace-1" });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("ticket-1");
    });
  });
});
