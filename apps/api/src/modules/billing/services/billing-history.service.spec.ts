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
        { provide: BillingHistoryRepository, useValue: { record: jest.fn() } },
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
});
