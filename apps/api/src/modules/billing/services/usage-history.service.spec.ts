import { Test } from "@nestjs/testing";
import { UsageHistoryService } from "./usage-history.service.js";
import { UsageHistoryRepository } from "../repositories/usage-history.repository.js";

describe("UsageHistoryService", () => {
  let service: UsageHistoryService;
  let usageHistoryRepository: jest.Mocked<UsageHistoryRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsageHistoryService,
        { provide: UsageHistoryRepository, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(UsageHistoryService);
    usageHistoryRepository = moduleRef.get(UsageHistoryRepository);
  });

  it("writes an entry without emitting any further event (§12 lists no 'Usage History Recorded' event)", async () => {
    const occurredAt = new Date();
    await service.record(
      "workspace-1",
      "billing.usage_limit_exceeded",
      "Usage Limit Exceeded",
      {},
      occurredAt,
    );

    expect(usageHistoryRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        eventType: "billing.usage_limit_exceeded",
      }),
    );
  });
});
