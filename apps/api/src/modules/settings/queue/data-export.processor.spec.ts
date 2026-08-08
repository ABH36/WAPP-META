import { Test } from "@nestjs/testing";
import type { Job } from "bullmq";
import { DataExportProcessor } from "./data-export.processor.js";
import { ExportJobRepository } from "../repositories/export-job.repository.js";
import { ReportsService } from "../../crm/services/reports.service.js";
import { CustomerRepository } from "../../crm/repositories/customer.repository.js";
import { BillingReportsService } from "../../billing/services/billing-reports.service.js";
import { WorkspaceSettingsRepository } from "../repositories/workspace-settings.repository.js";
import { FeatureFlagRepository } from "../repositories/feature-flag.repository.js";
import { RetentionPolicyRepository } from "../repositories/retention-policy.repository.js";
import { StorageService } from "../../../infrastructure/storage/storage.service.js";
import { ExportEntityType, ExportFormat } from "../schemas/export-job.schema.js";
import type { DataExportJob } from "../services/data-export.service.js";

function fakeJob(data: DataExportJob): Job<DataExportJob> {
  return { data } as Job<DataExportJob>;
}

describe("DataExportProcessor", () => {
  let processor: DataExportProcessor;
  let exportJobRepository: jest.Mocked<ExportJobRepository>;
  let reportsService: jest.Mocked<ReportsService>;
  let customerRepository: jest.Mocked<CustomerRepository>;
  let billingReportsService: jest.Mocked<BillingReportsService>;
  let workspaceSettingsRepository: jest.Mocked<WorkspaceSettingsRepository>;
  let featureFlagRepository: jest.Mocked<FeatureFlagRepository>;
  let retentionPolicyRepository: jest.Mocked<RetentionPolicyRepository>;
  let storageService: jest.Mocked<StorageService>;

  const jobData: DataExportJob = { exportJobId: "job-1", workspaceId: "workspace-1" };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DataExportProcessor,
        {
          provide: ExportJobRepository,
          useValue: {
            findByIdForWorkspace: jest.fn(),
            markProcessing: jest.fn(),
            markCompleted: jest.fn(),
            markFailed: jest.fn(),
          },
        },
        { provide: ReportsService, useValue: { exportReport: jest.fn() } },
        { provide: CustomerRepository, useValue: { findAllForWorkspace: jest.fn() } },
        { provide: BillingReportsService, useValue: { exportReport: jest.fn() } },
        { provide: WorkspaceSettingsRepository, useValue: { getOrCreate: jest.fn() } },
        { provide: FeatureFlagRepository, useValue: { findByWorkspace: jest.fn() } },
        { provide: RetentionPolicyRepository, useValue: { getOrCreate: jest.fn() } },
        { provide: StorageService, useValue: { uploadBuffer: jest.fn() } },
      ],
    }).compile();

    processor = moduleRef.get(DataExportProcessor);
    exportJobRepository = moduleRef.get(ExportJobRepository);
    reportsService = moduleRef.get(ReportsService);
    customerRepository = moduleRef.get(CustomerRepository);
    billingReportsService = moduleRef.get(BillingReportsService);
    workspaceSettingsRepository = moduleRef.get(WorkspaceSettingsRepository);
    featureFlagRepository = moduleRef.get(FeatureFlagRepository);
    retentionPolicyRepository = moduleRef.get(RetentionPolicyRepository);
    storageService = moduleRef.get(StorageService);
  });

  it("does nothing when the job no longer exists", async () => {
    exportJobRepository.findByIdForWorkspace.mockResolvedValue(null);
    await processor.process(fakeJob(jobData));
    expect(exportJobRepository.markProcessing).not.toHaveBeenCalled();
  });

  it("builds a CUSTOMERS CSV export directly (no CRM report reuse) and uploads it", async () => {
    exportJobRepository.findByIdForWorkspace.mockResolvedValue({
      entityType: ExportEntityType.CUSTOMERS,
      format: ExportFormat.CSV,
    } as never);
    customerRepository.findAllForWorkspace.mockResolvedValue([
      {
        customerName: "Acme Co",
        mobileNumber: "+919876543210",
        companyName: "Acme",
        email: "acme@example.com",
        status: "ACTIVE",
        source: "MANUAL",
        createdAt: new Date("2026-08-08T00:00:00.000Z"),
      } as never,
    ]);
    storageService.uploadBuffer.mockResolvedValue({
      url: "https://cloud/export.csv",
      publicId: "pub-1",
    });

    await processor.process(fakeJob(jobData));

    expect(exportJobRepository.markProcessing).toHaveBeenCalledWith("job-1");
    expect(reportsService.exportReport).not.toHaveBeenCalled();
    expect(storageService.uploadBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      "exports/workspace-1",
      expect.stringContaining("customers-job-1.csv"),
    );
    expect(exportJobRepository.markCompleted).toHaveBeenCalledWith(
      "job-1",
      "https://cloud/export.csv",
    );
  });

  it("reuses CRM's ReportsService.exportReport for LEADS", async () => {
    exportJobRepository.findByIdForWorkspace.mockResolvedValue({
      entityType: ExportEntityType.LEADS,
      format: ExportFormat.EXCEL,
    } as never);
    reportsService.exportReport.mockResolvedValue({
      buffer: Buffer.from("data"),
      filename: "leads-report.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    storageService.uploadBuffer.mockResolvedValue({
      url: "https://cloud/leads.xlsx",
      publicId: "p",
    });

    await processor.process(fakeJob(jobData));

    expect(reportsService.exportReport).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({ type: "leads", format: "excel" }),
    );
    expect(exportJobRepository.markCompleted).toHaveBeenCalled();
  });

  it("marks the job FAILED with a clear message when JSON is requested for a CRM-backed entity type", async () => {
    exportJobRepository.findByIdForWorkspace.mockResolvedValue({
      entityType: ExportEntityType.DEALS,
      format: ExportFormat.JSON,
    } as never);

    await processor.process(fakeJob(jobData));

    expect(reportsService.exportReport).not.toHaveBeenCalled();
    expect(exportJobRepository.markFailed).toHaveBeenCalledWith(
      "job-1",
      expect.stringContaining("JSON format is not supported"),
    );
  });

  it("builds a SETTINGS JSON export directly from Settings-owned data", async () => {
    exportJobRepository.findByIdForWorkspace.mockResolvedValue({
      entityType: ExportEntityType.SETTINGS,
      format: ExportFormat.JSON,
    } as never);
    workspaceSettingsRepository.getOrCreate.mockResolvedValue({
      currency: "INR",
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h",
      logoUrl: null,
    } as never);
    featureFlagRepository.findByWorkspace.mockResolvedValue([]);
    retentionPolicyRepository.getOrCreate.mockResolvedValue({
      auditLogRetentionDays: 365,
      loginHistoryRetentionDays: 365,
      notificationHistoryRetentionDays: 365,
      webhookDeliveryLogRetentionDays: 365,
    } as never);
    storageService.uploadBuffer.mockResolvedValue({
      url: "https://cloud/settings.json",
      publicId: "p",
    });

    await processor.process(fakeJob(jobData));

    expect(storageService.uploadBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      "exports/workspace-1",
      expect.stringContaining(".json"),
    );
    expect(exportJobRepository.markCompleted).toHaveBeenCalled();
  });

  it("marks the job FAILED when the Billing report call throws", async () => {
    exportJobRepository.findByIdForWorkspace.mockResolvedValue({
      entityType: ExportEntityType.BILLING,
      format: ExportFormat.CSV,
    } as never);
    billingReportsService.exportReport.mockRejectedValue(new Error("Billing unavailable"));

    await processor.process(fakeJob(jobData));

    expect(exportJobRepository.markFailed).toHaveBeenCalledWith("job-1", "Billing unavailable");
  });
});
