import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { QueueStatusService } from "./queue-status.service.js";

const getJobCounts = jest.fn();
const getWorkersCount = jest.fn();
const close = jest.fn();

jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation((name: string) => ({
    name,
    getJobCounts,
    getWorkersCount,
    close,
  })),
}));

describe("QueueStatusService", () => {
  let service: QueueStatusService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        QueueStatusService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue("redis://localhost:6379") },
        },
      ],
    }).compile();

    service = moduleRef.get(QueueStatusService);
  });

  it("reports job counts and worker count for every registered queue", async () => {
    getJobCounts.mockResolvedValue({ waiting: 1, active: 2, completed: 10, failed: 0, delayed: 0 });
    getWorkersCount.mockResolvedValue(1);

    const result = await service.getStatus();

    expect(result).toHaveLength(11);
    expect(typeof result[0]?.name).toBe("string");
    expect(result[0]).toMatchObject({
      waiting: 1,
      active: 2,
      completed: 10,
      failed: 0,
      delayed: 0,
      workers: 1,
    });
  });

  it("defaults missing job-count fields to 0", async () => {
    getJobCounts.mockResolvedValue({});
    getWorkersCount.mockResolvedValue(0);

    const [entry] = await service.getStatus();

    expect(entry).toMatchObject({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 });
  });

  it("closes every queue handle on module destroy", async () => {
    await service.onModuleDestroy();
    expect(close).toHaveBeenCalledTimes(11);
  });
});
