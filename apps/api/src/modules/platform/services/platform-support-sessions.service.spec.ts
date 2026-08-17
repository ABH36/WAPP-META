import { Test } from "@nestjs/testing";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PlatformSupportSessionsService } from "./platform-support-sessions.service.js";
import { SupportSessionRepository } from "../repositories/support-session.repository.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import { SupportSessionStatus } from "../schemas/support-session.schema.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

const baseSession = {
  _id: { toString: () => "session-1" },
  workspaceId: "workspace-1",
  requestedBy: "op-1",
  approvedBy: null as string | null,
  reason: "Investigating a billing discrepancy",
  durationMinutes: 60,
  status: SupportSessionStatus.REQUESTED,
  approvedAt: null as Date | null,
  startedBy: null as string | null,
  startedAt: null as Date | null,
  expiresAt: null as Date | null,
  endedAt: null as Date | null,
  terminationReason: null as string | null,
  createdAt: new Date("2026-08-10T00:00:00.000Z"),
  updatedAt: new Date("2026-08-10T00:00:00.000Z"),
};

describe("PlatformSupportSessionsService", () => {
  let service: PlatformSupportSessionsService;
  let supportSessionRepository: jest.Mocked<SupportSessionRepository>;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformSupportSessionsService,
        {
          provide: SupportSessionRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            approve: jest.fn(),
            start: jest.fn(),
            terminate: jest.fn(),
            expire: jest.fn(),
            list: jest.fn(),
            findActiveForWorkspaceAndUser: jest.fn(),
            findExpiredActive: jest.fn(),
          },
        },
        { provide: WorkspaceRepository, useValue: { findById: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        MetricsService,
      ],
    }).compile();

    service = moduleRef.get(PlatformSupportSessionsService);
    supportSessionRepository = moduleRef.get(SupportSessionRepository);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("request", () => {
    it("creates a REQUESTED session and emits BREAK_GLASS_REQUESTED", async () => {
      workspaceRepository.findById.mockResolvedValue({} as never);
      supportSessionRepository.create.mockResolvedValue(baseSession as never);

      const result = await service.request(
        "workspace-1",
        "Investigating a billing discrepancy",
        60,
        "op-1",
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.BREAK_GLASS_REQUESTED,
        expect.objectContaining({
          workspaceId: "workspace-1",
          reason: "Investigating a billing discrepancy",
          durationMinutes: 60,
        }),
      );
      expect(result.status).toBe(SupportSessionStatus.REQUESTED);
    });

    it("rejects a duration beyond 240 minutes", async () => {
      await expect(service.request("workspace-1", "reason", 241, "op-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(workspaceRepository.findById).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for a missing workspace", async () => {
      workspaceRepository.findById.mockResolvedValue(null);

      await expect(service.request("missing", "reason", 60, "op-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(supportSessionRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("approve", () => {
    it("approves a REQUESTED session and emits BREAK_GLASS_APPROVED", async () => {
      supportSessionRepository.findById.mockResolvedValue(baseSession as never);
      supportSessionRepository.approve.mockResolvedValue({
        ...baseSession,
        status: SupportSessionStatus.APPROVED,
        approvedBy: "super-1",
      } as never);

      const result = await service.approve("session-1", "super-1");

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.BREAK_GLASS_APPROVED,
        expect.objectContaining({ sessionId: "session-1", actorId: "super-1" }),
      );
      expect(result.status).toBe(SupportSessionStatus.APPROVED);
    });

    it("rejects approving a session that isn't REQUESTED", async () => {
      supportSessionRepository.findById.mockResolvedValue({
        ...baseSession,
        status: SupportSessionStatus.APPROVED,
      } as never);

      await expect(service.approve("session-1", "super-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("start", () => {
    it("starts an APPROVED session, computing expiresAt from durationMinutes, and emits SUPPORT_SESSION_STARTED", async () => {
      supportSessionRepository.findById.mockResolvedValue({
        ...baseSession,
        status: SupportSessionStatus.APPROVED,
      } as never);
      supportSessionRepository.start.mockResolvedValue({
        ...baseSession,
        status: SupportSessionStatus.ACTIVE,
        startedBy: "super-1",
      } as never);

      const result = await service.start("session-1", "super-1");

      expect(supportSessionRepository.start).toHaveBeenCalledWith(
        "session-1",
        "super-1",
        expect.any(Date),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.SUPPORT_SESSION_STARTED,
        expect.objectContaining({ sessionId: "session-1", actorId: "super-1" }),
      );
      expect(result.status).toBe(SupportSessionStatus.ACTIVE);
    });

    it("rejects starting a session that isn't APPROVED", async () => {
      supportSessionRepository.findById.mockResolvedValue(baseSession as never);

      await expect(service.start("session-1", "super-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("end", () => {
    it("ends an ACTIVE session and emits SUPPORT_SESSION_TERMINATED", async () => {
      supportSessionRepository.findById.mockResolvedValue({
        ...baseSession,
        status: SupportSessionStatus.ACTIVE,
      } as never);
      supportSessionRepository.terminate.mockResolvedValue({
        ...baseSession,
        status: SupportSessionStatus.TERMINATED,
        terminationReason: "Investigation complete",
      } as never);

      const result = await service.end("session-1", "Investigation complete", "super-1");

      expect(supportSessionRepository.terminate).toHaveBeenCalledWith(
        "session-1",
        "Investigation complete",
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.SUPPORT_SESSION_TERMINATED,
        expect.objectContaining({ reason: "Investigation complete" }),
      );
      expect(result.status).toBe(SupportSessionStatus.TERMINATED);
    });

    it("defaults the termination reason when none is given", async () => {
      supportSessionRepository.findById.mockResolvedValue({
        ...baseSession,
        status: SupportSessionStatus.ACTIVE,
      } as never);
      supportSessionRepository.terminate.mockResolvedValue({
        ...baseSession,
        status: SupportSessionStatus.TERMINATED,
      } as never);

      await service.end("session-1", null, "super-1");

      expect(supportSessionRepository.terminate).toHaveBeenCalledWith(
        "session-1",
        "Ended by operator",
      );
    });

    it("rejects ending a session that isn't ACTIVE", async () => {
      supportSessionRepository.findById.mockResolvedValue(baseSession as never);

      await expect(service.end("session-1", null, "super-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("ensureActiveAccess (§11 real-time authorization gate)", () => {
    it("resolves silently when an active, unexpired session exists for that workspace+user", async () => {
      supportSessionRepository.findActiveForWorkspaceAndUser.mockResolvedValue(
        baseSession as never,
      );

      await expect(service.ensureActiveAccess("workspace-1", "super-1")).resolves.toBeUndefined();
    });

    it("throws ForbiddenException when no active session exists", async () => {
      supportSessionRepository.findActiveForWorkspaceAndUser.mockResolvedValue(null);

      await expect(service.ensureActiveAccess("workspace-1", "super-1")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("expireOverdueSessions (sweep)", () => {
    it("expires every overdue ACTIVE session and emits SUPPORT_SESSION_EXPIRED per session", async () => {
      supportSessionRepository.findExpiredActive.mockResolvedValue([
        { ...baseSession, status: SupportSessionStatus.ACTIVE } as never,
      ]);

      const count = await service.expireOverdueSessions(new Date());

      expect(count).toBe(1);
      expect(supportSessionRepository.expire).toHaveBeenCalledWith("session-1");
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.SUPPORT_SESSION_EXPIRED,
        expect.objectContaining({ sessionId: "session-1", actorId: "system" }),
      );
    });
  });

  describe("list", () => {
    it("returns mapped summaries", async () => {
      supportSessionRepository.list.mockResolvedValue({ items: [baseSession as never], total: 1 });

      const result = await service.list({ workspaceId: "workspace-1" }, 1, 20);

      expect(result.total).toBe(1);
      expect(result.items[0]?.id).toBe("session-1");
    });

    it("clamps an oversized limit to MAX_PAGE_SIZE (100) instead of passing it through unbounded", async () => {
      supportSessionRepository.list.mockResolvedValue({ items: [], total: 0 });

      await service.list({}, 1, 999_999);

      expect(supportSessionRepository.list).toHaveBeenCalledWith({}, 1, 100);
    });
  });
});
