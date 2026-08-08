import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BillingHistoryService } from "./billing-history.service.js";
import { BillingHistoryRepository } from "../repositories/billing-history.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

describe("BillingHistoryService", () => {
  let service: BillingHistoryService;
  let billingHistoryRepository: jest.Mocked<BillingHistoryRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingHistoryService,
        {
          provide: BillingHistoryRepository,
          useValue: { record: jest.fn(), findByWorkspace: jest.fn(), countByEventType: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(BillingHistoryService);
    billingHistoryRepository = moduleRef.get(BillingHistoryRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  it("writes an entry and emits BILLING_HISTORY_RECORDED (not the triggering event itself)", async () => {
    billingHistoryRepository.record.mockResolvedValue({
      _id: { toString: () => "entry-1" },
    } as never);

    const occurredAt = new Date();
    await service.record("workspace-1", DomainEvent.TRIAL_STARTED, "Trial Started", {}, occurredAt);

    expect(billingHistoryRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "workspace-1", eventType: DomainEvent.TRIAL_STARTED }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.BILLING_HISTORY_RECORDED,
      expect.objectContaining({ entryId: "entry-1", eventType: DomainEvent.TRIAL_STARTED }),
    );
  });

  describe("listRecentForWorkspace / countByEventTypeForPlatform (PRD-007 Volume-2 §4.5/§4.7)", () => {
    it("maps repository results to summaries", async () => {
      billingHistoryRepository.findByWorkspace.mockResolvedValue([
        {
          _id: { toString: () => "entry-1" },
          workspaceId: "workspace-1",
          eventType: DomainEvent.TRIAL_STARTED,
          description: "Trial Started",
          metadata: {},
          occurredAt: new Date("2026-08-01T00:00:00.000Z"),
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        } as never,
      ]);

      const result = await service.listRecentForWorkspace("workspace-1", 20);

      expect(billingHistoryRepository.findByWorkspace).toHaveBeenCalledWith("workspace-1", 20);
      expect(result[0]?.id).toBe("entry-1");
    });

    it("delegates the cross-tenant event-type count", async () => {
      billingHistoryRepository.countByEventType.mockResolvedValue(7);

      const count = await service.countByEventTypeForPlatform(DomainEvent.TRIAL_EXTENDED);

      expect(billingHistoryRepository.countByEventType).toHaveBeenCalledWith(
        DomainEvent.TRIAL_EXTENDED,
      );
      expect(count).toBe(7);
    });
  });
});
