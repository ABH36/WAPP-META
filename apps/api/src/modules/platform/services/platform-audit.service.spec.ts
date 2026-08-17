import { Test } from "@nestjs/testing";
import { PlatformAuditService } from "./platform-audit.service.js";
import { PlatformAuditRepository } from "../repositories/platform-audit.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

const baseEntry = {
  _id: { toString: () => "entry-1" },
  eventType: DomainEvent.BREAK_GLASS_REQUESTED,
  description: "Break-Glass Access Requested",
  workspaceId: "workspace-1",
  actorId: "op-1",
  metadata: {},
  occurredAt: new Date("2026-08-10T00:00:00.000Z"),
  createdAt: new Date("2026-08-10T00:00:00.000Z"),
};

describe("PlatformAuditService", () => {
  let service: PlatformAuditService;
  let platformAuditRepository: jest.Mocked<PlatformAuditRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformAuditService,
        {
          provide: PlatformAuditRepository,
          useValue: { record: jest.fn(), list: jest.fn(), findByWorkspace: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(PlatformAuditService);
    platformAuditRepository = moduleRef.get(PlatformAuditRepository);
  });

  it("record() persists the entry as-is", async () => {
    platformAuditRepository.record.mockResolvedValue(baseEntry as never);

    await service.record(
      DomainEvent.BREAK_GLASS_REQUESTED,
      "Break-Glass Access Requested",
      "workspace-1",
      "op-1",
      { reason: "test" },
      new Date("2026-08-10T00:00:00.000Z"),
    );

    expect(platformAuditRepository.record).toHaveBeenCalledWith({
      eventType: DomainEvent.BREAK_GLASS_REQUESTED,
      description: "Break-Glass Access Requested",
      workspaceId: "workspace-1",
      actorId: "op-1",
      metadata: { reason: "test" },
      occurredAt: new Date("2026-08-10T00:00:00.000Z"),
    });
  });

  it("list() maps repository results to summaries", async () => {
    platformAuditRepository.list.mockResolvedValue({ items: [baseEntry as never], total: 1 });

    const result = await service.list({ workspaceId: "workspace-1" }, 1, 50);

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe("entry-1");
  });

  it("list() clamps an oversized limit to MAX_PAGE_SIZE (100) instead of passing it through unbounded", async () => {
    platformAuditRepository.list.mockResolvedValue({ items: [], total: 0 });

    await service.list({}, 1, 999_999);

    expect(platformAuditRepository.list).toHaveBeenCalledWith({}, 1, 100);
  });

  it("listRecentForWorkspace() maps repository results to summaries", async () => {
    platformAuditRepository.findByWorkspace.mockResolvedValue([baseEntry as never]);

    const result = await service.listRecentForWorkspace("workspace-1", 25);

    expect(platformAuditRepository.findByWorkspace).toHaveBeenCalledWith("workspace-1", 25);
    expect(result).toHaveLength(1);
  });
});
