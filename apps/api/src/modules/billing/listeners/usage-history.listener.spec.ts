import { Test } from "@nestjs/testing";
import { UsageHistoryListener } from "./usage-history.listener.js";
import { UsageHistoryService } from "../services/usage-history.service.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

describe("UsageHistoryListener", () => {
  let listener: UsageHistoryListener;
  let usageHistoryService: jest.Mocked<UsageHistoryService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsageHistoryListener,
        { provide: UsageHistoryService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    listener = moduleRef.get(UsageHistoryListener);
    usageHistoryService = moduleRef.get(UsageHistoryService);
  });

  it("records a Usage Limit Exceeded event with the counter type in the description", async () => {
    const occurredAt = new Date().toISOString();
    await listener.onUsageLimitExceeded({
      workspaceId: "workspace-1",
      counterType: "CUSTOMERS",
      currentCount: 11,
      limit: 10,
      occurredAt,
    });

    expect(usageHistoryService.record).toHaveBeenCalledWith(
      "workspace-1",
      DomainEvent.USAGE_LIMIT_EXCEEDED,
      expect.stringContaining("CUSTOMERS"),
      expect.anything(),
      new Date(occurredAt),
    );
  });

  it("records a Workspace Locked event", async () => {
    const occurredAt = new Date().toISOString();
    await listener.onWorkspaceLocked({
      workspaceId: "workspace-1",
      counterType: "CUSTOMERS",
      occurredAt,
    });

    expect(usageHistoryService.record).toHaveBeenCalledWith(
      "workspace-1",
      DomainEvent.WORKSPACE_LOCKED,
      expect.stringContaining("Workspace Locked"),
      expect.anything(),
      new Date(occurredAt),
    );
  });
});
