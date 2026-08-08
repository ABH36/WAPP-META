import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { DataExportService } from "./data-export.service.js";
import { ExportJobRepository } from "../repositories/export-job.repository.js";
import { DATA_EXPORT_QUEUE } from "../queue/data-export.constants.js";
import { ExportEntityType, ExportFormat, ExportJobStatus } from "../schemas/export-job.schema.js";

describe("DataExportService", () => {
  let service: DataExportService;
  let exportJobRepository: jest.Mocked<ExportJobRepository>;
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    queue = { add: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DataExportService,
        {
          provide: ExportJobRepository,
          useValue: {
            findActiveByWorkspace: jest.fn(),
            create: jest.fn(),
            findByIdForWorkspace: jest.fn(),
          },
        },
        { provide: getQueueToken(DATA_EXPORT_QUEUE), useValue: queue },
      ],
    }).compile();

    service = moduleRef.get(DataExportService);
    exportJobRepository = moduleRef.get(ExportJobRepository);
  });

  describe("create", () => {
    it("§10 — rejects a new export when one is already active for the workspace", async () => {
      exportJobRepository.findActiveByWorkspace.mockResolvedValue({
        status: ExportJobStatus.PROCESSING,
      } as never);

      await expect(
        service.create("workspace-1", "user-1", {
          entityType: ExportEntityType.CUSTOMERS,
          format: ExportFormat.CSV,
        }),
      ).rejects.toThrow("already in progress");
      expect(exportJobRepository.create).not.toHaveBeenCalled();
    });

    it("creates the job and enqueues it with the workspace id", async () => {
      exportJobRepository.findActiveByWorkspace.mockResolvedValue(null);
      exportJobRepository.create.mockResolvedValue({
        _id: { toString: () => "job-1" },
        entityType: ExportEntityType.CUSTOMERS,
        format: ExportFormat.CSV,
        status: ExportJobStatus.PENDING,
        resultUrl: null,
        error: null,
        createdAt: new Date("2026-08-08T00:00:00.000Z"),
      } as never);

      const result = await service.create("workspace-1", "user-1", {
        entityType: ExportEntityType.CUSTOMERS,
        format: ExportFormat.CSV,
      });

      expect(queue.add).toHaveBeenCalledWith(
        "export",
        { exportJobId: "job-1", workspaceId: "workspace-1" },
        { attempts: 1 },
      );
      expect(result.status).toBe(ExportJobStatus.PENDING);
    });
  });

  describe("getStatus", () => {
    it("throws NotFoundException for a job that doesn't belong to the workspace", async () => {
      exportJobRepository.findByIdForWorkspace.mockResolvedValue(null);
      await expect(service.getStatus("workspace-1", "job-1")).rejects.toThrow(
        "Export job not found",
      );
    });
  });
});
