import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { BroadcastService } from "./broadcast.service.js";
import { BroadcastRepository } from "../repositories/broadcast.repository.js";
import { BroadcastRecipientRepository } from "../repositories/broadcast-recipient.repository.js";
import { TemplateRepository } from "../repositories/template.repository.js";
import { PhoneNumberRepository } from "../repositories/phone-number.repository.js";
import { ContactRepository } from "../repositories/contact.repository.js";
import { MessageService } from "./message.service.js";
import { BroadcastStatus } from "../schemas/broadcast.schema.js";
import { TemplateStatus } from "../schemas/template.schema.js";
import { BROADCAST_EXECUTION_QUEUE } from "../queue/broadcast-execution.constants.js";
import { CorrelationContextService } from "../../../common/observability/correlation-context.service.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

describe("BroadcastService", () => {
  let service: BroadcastService;
  let broadcastRepository: jest.Mocked<BroadcastRepository>;
  let recipientRepository: jest.Mocked<BroadcastRecipientRepository>;
  let templateRepository: jest.Mocked<TemplateRepository>;
  let phoneNumberRepository: jest.Mocked<PhoneNumberRepository>;
  let contactRepository: jest.Mocked<ContactRepository>;
  let messageService: jest.Mocked<MessageService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let queue: { add: jest.Mock };

  const baseBroadcast = {
    _id: { toString: () => "broadcast-1" },
    workspaceId: "workspace-1",
    name: "Sale announcement",
    templateId: { toString: () => "template-1" },
    phoneNumberId: { toString: () => "phone-1" },
    bodyParameters: [],
    status: BroadcastStatus.DRAFT,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    failureReason: null,
    createdBy: "user-1",
    createdAt: new Date("2026-08-05T00:00:00.000Z"),
  };

  beforeEach(async () => {
    queue = { add: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        BroadcastService,
        {
          provide: BroadcastRepository,
          useValue: {
            create: jest.fn(),
            findByIdForWorkspace: jest.fn(),
            findByWorkspace: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: BroadcastRecipientRepository,
          useValue: {
            bulkCreatePending: jest.fn(),
            findPendingBatch: jest.fn(),
            markSent: jest.fn(),
            markFailed: jest.fn(),
            findByBroadcast: jest.fn(),
            getStats: jest.fn(),
          },
        },
        { provide: TemplateRepository, useValue: { findByIdForWorkspace: jest.fn() } },
        { provide: PhoneNumberRepository, useValue: { findByIdForWorkspace: jest.fn() } },
        {
          provide: ContactRepository,
          useValue: { findByIdsForWorkspace: jest.fn(), findByIdForWorkspace: jest.fn() },
        },
        { provide: MessageService, useValue: { sendTemplate: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: getQueueToken(BROADCAST_EXECUTION_QUEUE), useValue: queue },
        CorrelationContextService,
        MetricsService,
      ],
    }).compile();

    service = moduleRef.get(BroadcastService);
    broadcastRepository = moduleRef.get(BroadcastRepository);
    recipientRepository = moduleRef.get(BroadcastRecipientRepository);
    templateRepository = moduleRef.get(TemplateRepository);
    phoneNumberRepository = moduleRef.get(PhoneNumberRepository);
    contactRepository = moduleRef.get(ContactRepository);
    messageService = moduleRef.get(MessageService);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("create", () => {
    it("throws when the template doesn't belong to the workspace", async () => {
      templateRepository.findByIdForWorkspace.mockResolvedValue(null);

      await expect(
        service.create("workspace-1", "user-1", {
          name: "Sale",
          templateId: "template-1",
          phoneNumberId: "phone-1",
          targetContactIds: ["contact-1"],
          bodyParameters: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws when a target Contact doesn't belong to the workspace", async () => {
      templateRepository.findByIdForWorkspace.mockResolvedValue({} as never);
      phoneNumberRepository.findByIdForWorkspace.mockResolvedValue({} as never);
      contactRepository.findByIdsForWorkspace.mockResolvedValue([{ _id: "contact-1" } as never]);

      await expect(
        service.create("workspace-1", "user-1", {
          name: "Sale",
          templateId: "template-1",
          phoneNumberId: "phone-1",
          targetContactIds: ["contact-1", "contact-2"],
          bodyParameters: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates a DRAFT broadcast and dedupes target Contacts, without enqueueing a job", async () => {
      templateRepository.findByIdForWorkspace.mockResolvedValue({} as never);
      phoneNumberRepository.findByIdForWorkspace.mockResolvedValue({} as never);
      contactRepository.findByIdsForWorkspace.mockResolvedValue([
        { _id: "contact-1" } as never,
        { _id: "contact-2" } as never,
      ]);
      broadcastRepository.create.mockResolvedValue(baseBroadcast as never);

      const result = await service.create("workspace-1", "user-1", {
        name: "Sale",
        templateId: "template-1",
        phoneNumberId: "phone-1",
        targetContactIds: ["contact-1", "contact-2", "contact-1"],
        bodyParameters: [],
      });

      expect(result.status).toBe(BroadcastStatus.DRAFT);
      expect(recipientRepository.bulkCreatePending).toHaveBeenCalledWith(
        "workspace-1",
        "broadcast-1",
        ["contact-1", "contact-2"],
      );
      expect(queue.add).not.toHaveBeenCalled();
    });

    it("creates a SCHEDULED broadcast and enqueues a delayed job", async () => {
      templateRepository.findByIdForWorkspace.mockResolvedValue({} as never);
      phoneNumberRepository.findByIdForWorkspace.mockResolvedValue({} as never);
      contactRepository.findByIdsForWorkspace.mockResolvedValue([{ _id: "contact-1" } as never]);
      broadcastRepository.create.mockResolvedValue({
        ...baseBroadcast,
        status: BroadcastStatus.SCHEDULED,
      } as never);

      const scheduledAt = new Date(Date.now() + 60_000);
      await service.create("workspace-1", "user-1", {
        name: "Sale",
        templateId: "template-1",
        phoneNumberId: "phone-1",
        targetContactIds: ["contact-1"],
        bodyParameters: [],
        scheduledAt,
      });

      const [jobName, jobData, jobOpts] = queue.add.mock.calls[0] as [
        string,
        { workspaceId: string; broadcastId: string; correlationId: string },
        { delay: number },
      ];
      expect(jobName).toBe("run");
      expect(jobData).toEqual(
        expect.objectContaining({ workspaceId: "workspace-1", broadcastId: "broadcast-1" }),
      );
      expect(jobOpts.delay).toBeGreaterThan(0);
      expect(jobOpts.delay).toBeLessThanOrEqual(60_000);
    });
  });

  describe("send", () => {
    it("rejects a non-DRAFT broadcast", async () => {
      broadcastRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseBroadcast,
        status: BroadcastStatus.RUNNING,
      } as never);

      await expect(service.send("workspace-1", "broadcast-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("transitions DRAFT to RUNNING, enqueues a job, and emits BROADCAST_STARTED", async () => {
      broadcastRepository.findByIdForWorkspace.mockResolvedValue(baseBroadcast as never);
      broadcastRepository.updateStatus.mockResolvedValue({
        ...baseBroadcast,
        status: BroadcastStatus.RUNNING,
      } as never);

      const result = await service.send("workspace-1", "broadcast-1", "user-1");

      expect(result.status).toBe(BroadcastStatus.RUNNING);
      expect(queue.add).toHaveBeenCalledWith(
        "run",
        expect.objectContaining({ workspaceId: "workspace-1", broadcastId: "broadcast-1" }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "communication.broadcast_started",
        expect.objectContaining({ broadcastId: "broadcast-1", startedBy: "user-1" }),
      );
    });
  });

  describe("pause / resume / cancel", () => {
    it("rejects pausing a DRAFT broadcast", async () => {
      broadcastRepository.findByIdForWorkspace.mockResolvedValue(baseBroadcast as never);
      await expect(service.pause("workspace-1", "broadcast-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects resuming a broadcast that isn't PAUSED", async () => {
      broadcastRepository.findByIdForWorkspace.mockResolvedValue(baseBroadcast as never);
      await expect(service.resume("workspace-1", "broadcast-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects cancelling an already-terminal broadcast", async () => {
      broadcastRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseBroadcast,
        status: BroadcastStatus.COMPLETED,
      } as never);
      await expect(service.cancel("workspace-1", "broadcast-1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("executeRun", () => {
    it("marks the broadcast FAILED when the template is no longer approved", async () => {
      broadcastRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseBroadcast,
        status: BroadcastStatus.RUNNING,
      } as never);
      templateRepository.findByIdForWorkspace.mockResolvedValue({
        status: TemplateStatus.PENDING,
      } as never);

      await service.executeRun("workspace-1", "broadcast-1");

      expect(broadcastRepository.updateStatus).toHaveBeenCalledWith(
        "broadcast-1",
        BroadcastStatus.FAILED,
        { failureReason: "Template is not (or is no longer) approved" },
      );
      expect(messageService.sendTemplate).not.toHaveBeenCalled();
    });

    it("sends to every PENDING recipient and marks the broadcast COMPLETED", async () => {
      const runningBroadcast = { ...baseBroadcast, status: BroadcastStatus.RUNNING };
      broadcastRepository.findByIdForWorkspace.mockResolvedValue(runningBroadcast as never);
      templateRepository.findByIdForWorkspace.mockResolvedValue({
        status: TemplateStatus.APPROVED,
      } as never);
      recipientRepository.findPendingBatch
        .mockResolvedValueOnce([
          {
            _id: { toString: () => "recipient-1" },
            contactId: { toString: () => "contact-1" },
          } as never,
        ])
        .mockResolvedValueOnce([]);
      contactRepository.findByIdForWorkspace.mockResolvedValue({
        phoneNumber: "+919876543210",
      } as never);
      messageService.sendTemplate.mockResolvedValue({ id: "message-1" } as never);
      recipientRepository.getStats.mockResolvedValue({ pending: 0, sent: 1, failed: 0, total: 1 });

      await service.executeRun("workspace-1", "broadcast-1");

      expect(messageService.sendTemplate).toHaveBeenCalledWith(
        "workspace-1",
        "phone-1",
        "user-1",
        { to: "+919876543210", templateId: "template-1", bodyParameters: [] },
        "broadcast-1",
      );
      expect(recipientRepository.markSent).toHaveBeenCalledWith("recipient-1", "message-1");
      const [, , completedExtra] = broadcastRepository.updateStatus.mock.calls.find(
        ([, status]) => status === BroadcastStatus.COMPLETED,
      )!;
      expect(completedExtra?.completedAt).toBeInstanceOf(Date);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "communication.broadcast_completed",
        expect.objectContaining({ broadcastId: "broadcast-1", sentCount: 1, failedCount: 0 }),
      );
    });

    it("marks a recipient FAILED when the send throws, without aborting the run", async () => {
      const runningBroadcast = { ...baseBroadcast, status: BroadcastStatus.RUNNING };
      broadcastRepository.findByIdForWorkspace.mockResolvedValue(runningBroadcast as never);
      templateRepository.findByIdForWorkspace.mockResolvedValue({
        status: TemplateStatus.APPROVED,
      } as never);
      recipientRepository.findPendingBatch
        .mockResolvedValueOnce([
          {
            _id: { toString: () => "recipient-1" },
            contactId: { toString: () => "contact-1" },
          } as never,
        ])
        .mockResolvedValueOnce([]);
      contactRepository.findByIdForWorkspace.mockResolvedValue({
        phoneNumber: "+919876543210",
      } as never);
      messageService.sendTemplate.mockRejectedValue(new Error("Meta rejected the send"));
      recipientRepository.getStats.mockResolvedValue({ pending: 0, sent: 0, failed: 1, total: 1 });

      await service.executeRun("workspace-1", "broadcast-1");

      expect(recipientRepository.markFailed).toHaveBeenCalledWith(
        "recipient-1",
        "Meta rejected the send",
      );
      expect(broadcastRepository.updateStatus).toHaveBeenCalledWith(
        "broadcast-1",
        BroadcastStatus.COMPLETED,
        expect.anything(),
      );
    });

    it("stops without marking COMPLETED when the broadcast is paused mid-run", async () => {
      broadcastRepository.findByIdForWorkspace
        .mockResolvedValueOnce({ ...baseBroadcast, status: BroadcastStatus.RUNNING } as never) // initial load in executeRun
        .mockResolvedValueOnce({ ...baseBroadcast, status: BroadcastStatus.PAUSED } as never); // re-check before the first recipient
      templateRepository.findByIdForWorkspace.mockResolvedValue({
        status: TemplateStatus.APPROVED,
      } as never);
      recipientRepository.findPendingBatch.mockResolvedValueOnce([
        {
          _id: { toString: () => "recipient-1" },
          contactId: { toString: () => "contact-1" },
        } as never,
      ]);

      await service.executeRun("workspace-1", "broadcast-1");

      expect(messageService.sendTemplate).not.toHaveBeenCalled();
      expect(broadcastRepository.updateStatus).not.toHaveBeenCalledWith(
        "broadcast-1",
        BroadcastStatus.COMPLETED,
        expect.anything(),
      );
    });
  });
});
