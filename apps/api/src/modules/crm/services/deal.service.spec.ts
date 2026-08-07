import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { DealLostReason, DealStage, TenantRole, WorkspaceMemberStatus } from "@wapp/shared-types";
import { DealService } from "./deal.service.js";
import { DealRepository } from "../repositories/deal.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

const baseDeal = {
  _id: { toString: () => "deal-1" },
  workspaceId: "workspace-1",
  contactId: { toString: () => "contact-1" },
  customerId: { toString: () => "customer-1" },
  sourceLeadId: { toString: () => "lead-1" },
  title: "Acme Opportunity",
  description: null,
  value: 0,
  currency: "INR",
  probability: 0,
  expectedCloseDate: null,
  assignedTo: null,
  stage: DealStage.OPEN,
  wonAt: null,
  lostAt: null,
  lostReason: null,
  createdBy: "user-1",
  updatedBy: "user-1",
  createdAt: new Date("2026-08-06T00:00:00.000Z"),
  updatedAt: new Date("2026-08-06T00:00:00.000Z"),
};

const SALES_EXECUTIVE_ID = "507f1f77bcf86cd799439011";

const salesExecutive = {
  _id: { toString: () => SALES_EXECUTIVE_ID },
  workspaceId: "workspace-1",
  workspaceMemberStatus: WorkspaceMemberStatus.ACTIVE,
  role: TenantRole.SALES_EXECUTIVE,
};

describe("DealService", () => {
  let service: DealService;
  let dealRepository: jest.Mocked<DealRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DealService,
        {
          provide: DealRepository,
          useValue: {
            findByIdForWorkspace: jest.fn(),
            list: jest.fn(),
            update: jest.fn(),
            updateAssignment: jest.fn(),
            updateStage: jest.fn(),
            reopen: jest.fn(),
          },
        },
        { provide: UserRepository, useValue: { findById: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(DealService);
    dealRepository = moduleRef.get(DealRepository);
    userRepository = moduleRef.get(UserRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("getById", () => {
    it("returns the mapped summary", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue(baseDeal as never);

      const result = await service.getById("workspace-1", "deal-1");

      expect(result.id).toBe("deal-1");
      expect(result.stage).toBe(DealStage.OPEN);
    });

    it("throws NotFoundException when the Deal doesn't exist", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue(null);

      await expect(service.getById("workspace-1", "deal-1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("updates general fields and emits DEAL_UPDATED", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue(baseDeal as never);
      dealRepository.update.mockResolvedValue({ ...baseDeal, value: 50000 } as never);

      const result = await service.update("workspace-1", "deal-1", { value: 50000 }, "user-1");

      expect(result.value).toBe(50000);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.DEAL_UPDATED,
        expect.objectContaining({ dealId: "deal-1", updatedBy: "user-1" }),
      );
    });

    it("converts expectedCloseDate to a Date before passing to the repository", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue(baseDeal as never);
      dealRepository.update.mockResolvedValue(baseDeal as never);

      await service.update(
        "workspace-1",
        "deal-1",
        { expectedCloseDate: "2026-09-01T00:00:00.000Z" },
        "user-1",
      );

      expect(dealRepository.update).toHaveBeenCalledWith(
        "workspace-1",
        "deal-1",
        expect.objectContaining({ expectedCloseDate: new Date("2026-09-01T00:00:00.000Z") }),
        "user-1",
      );
    });
  });

  describe("assign", () => {
    it("assigns to an eligible Sales Executive and emits DEAL_ASSIGNED", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue(baseDeal as never);
      userRepository.findById.mockResolvedValue(salesExecutive as never);
      dealRepository.updateAssignment.mockResolvedValue({
        ...baseDeal,
        assignedTo: SALES_EXECUTIVE_ID,
      } as never);

      const result = await service.assign("workspace-1", "deal-1", SALES_EXECUTIVE_ID, "user-1");

      expect(result.assignedTo).toBe(SALES_EXECUTIVE_ID);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.DEAL_ASSIGNED,
        expect.objectContaining({ dealId: "deal-1", assignedTo: SALES_EXECUTIVE_ID }),
      );
    });

    it("unassigns and emits DEAL_UNASSIGNED", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseDeal,
        assignedTo: SALES_EXECUTIVE_ID,
      } as never);
      dealRepository.updateAssignment.mockResolvedValue({
        ...baseDeal,
        assignedTo: null,
      } as never);

      const result = await service.assign("workspace-1", "deal-1", null, "user-1");

      expect(result.assignedTo).toBeNull();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.DEAL_UNASSIGNED,
        expect.objectContaining({ dealId: "deal-1", assignedTo: null }),
      );
    });

    it("rejects an assignee who isn't a Sales Executive", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue(baseDeal as never);
      userRepository.findById.mockResolvedValue({
        ...salesExecutive,
        role: TenantRole.SALES_MANAGER,
      } as never);

      await expect(
        service.assign("workspace-1", "deal-1", SALES_EXECUTIVE_ID, "user-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects an assignee from a different workspace", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue(baseDeal as never);
      userRepository.findById.mockResolvedValue({
        ...salesExecutive,
        workspaceId: "workspace-2",
      } as never);

      await expect(
        service.assign("workspace-1", "deal-1", SALES_EXECUTIVE_ID, "user-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a malformed assignee id without querying the database", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue(baseDeal as never);

      await expect(
        service.assign("workspace-1", "deal-1", "not-a-real-user-id", "user-1"),
      ).rejects.toThrow(BadRequestException);
      expect(userRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe("updateStage", () => {
    it("allows a legal non-terminal transition without requiring CLOSE_DEALS", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue(baseDeal as never);
      dealRepository.updateStage.mockResolvedValue({
        ...baseDeal,
        stage: DealStage.QUALIFICATION,
      } as never);

      const result = await service.updateStage(
        "workspace-1",
        "deal-1",
        { stage: DealStage.QUALIFICATION },
        "user-1",
        TenantRole.SALES_EXECUTIVE,
      );

      expect(result.stage).toBe(DealStage.QUALIFICATION);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.DEAL_STAGE_CHANGED,
        expect.objectContaining({
          previousStage: DealStage.OPEN,
          newStage: DealStage.QUALIFICATION,
        }),
      );
    });

    it("rejects an illegal transition (skipping OPEN -> WON)", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue(baseDeal as never);

      await expect(
        service.updateStage(
          "workspace-1",
          "deal-1",
          { stage: DealStage.WON },
          "user-1",
          TenantRole.OWNER,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(dealRepository.updateStage).not.toHaveBeenCalled();
    });

    it("rejects a terminal transition from a role without CLOSE_DEALS (Sales Executive)", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseDeal,
        stage: DealStage.NEGOTIATION,
      } as never);

      await expect(
        service.updateStage(
          "workspace-1",
          "deal-1",
          { stage: DealStage.WON },
          "user-1",
          TenantRole.SALES_EXECUTIVE,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(dealRepository.updateStage).not.toHaveBeenCalled();
    });

    it("allows a terminal WON transition for a role with CLOSE_DEALS (Sales Manager) and sets wonAt", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseDeal,
        stage: DealStage.NEGOTIATION,
      } as never);
      dealRepository.updateStage.mockResolvedValue({
        ...baseDeal,
        stage: DealStage.WON,
        wonAt: new Date(),
      } as never);

      const result = await service.updateStage(
        "workspace-1",
        "deal-1",
        { stage: DealStage.WON },
        "user-1",
        TenantRole.SALES_MANAGER,
      );

      expect(result.stage).toBe(DealStage.WON);
      expect(dealRepository.updateStage).toHaveBeenCalledWith(
        "workspace-1",
        "deal-1",
        DealStage.WON,
        "user-1",
        expect.objectContaining({
          wonAt: expect.any(Date) as Date,
          lostAt: null,
          lostReason: null,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.DEAL_WON,
        expect.objectContaining({ newStage: DealStage.WON }),
      );
    });

    it("rejects marking LOST without a lostReason (BR-007)", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue(baseDeal as never);

      await expect(
        service.updateStage(
          "workspace-1",
          "deal-1",
          { stage: DealStage.LOST },
          "user-1",
          TenantRole.OWNER,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(dealRepository.updateStage).not.toHaveBeenCalled();
    });

    it("marks LOST with a lostReason and emits DEAL_LOST", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue(baseDeal as never);
      dealRepository.updateStage.mockResolvedValue({
        ...baseDeal,
        stage: DealStage.LOST,
        lostAt: new Date(),
        lostReason: DealLostReason.PRICE,
      } as never);

      const result = await service.updateStage(
        "workspace-1",
        "deal-1",
        { stage: DealStage.LOST, lostReason: DealLostReason.PRICE },
        "user-1",
        TenantRole.OWNER,
      );

      expect(result.lostReason).toBe(DealLostReason.PRICE);
      expect(dealRepository.updateStage).toHaveBeenCalledWith(
        "workspace-1",
        "deal-1",
        DealStage.LOST,
        "user-1",
        expect.objectContaining({
          lostAt: expect.any(Date) as Date,
          lostReason: DealLostReason.PRICE,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.DEAL_LOST,
        expect.objectContaining({ newStage: DealStage.LOST }),
      );
    });

    it("rejects any further transition once a Deal is WON (terminal)", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseDeal,
        stage: DealStage.WON,
      } as never);

      await expect(
        service.updateStage(
          "workspace-1",
          "deal-1",
          { stage: DealStage.OPEN },
          "user-1",
          TenantRole.OWNER,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("reopen", () => {
    it("resets a LOST Deal to OPEN and emits DEAL_REOPENED", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseDeal,
        stage: DealStage.LOST,
        lostAt: new Date(),
        lostReason: DealLostReason.PRICE,
      } as never);
      dealRepository.reopen.mockResolvedValue({ ...baseDeal, stage: DealStage.OPEN } as never);

      const result = await service.reopen("workspace-1", "deal-1", "user-1");

      expect(result.stage).toBe(DealStage.OPEN);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.DEAL_REOPENED,
        expect.objectContaining({ dealId: "deal-1", actorId: "user-1" }),
      );
    });

    it("rejects reopening a Deal that isn't LOST", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue(baseDeal as never);

      await expect(service.reopen("workspace-1", "deal-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(dealRepository.reopen).not.toHaveBeenCalled();
    });

    it("rejects reopening a WON Deal", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseDeal,
        stage: DealStage.WON,
      } as never);

      await expect(service.reopen("workspace-1", "deal-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
