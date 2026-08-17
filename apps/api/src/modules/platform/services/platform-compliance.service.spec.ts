import { Test } from "@nestjs/testing";
import { ExportJobStatus } from "../../settings/schemas/export-job.schema.js";
import { PlatformComplianceService } from "./platform-compliance.service.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { RetentionPolicyRepository } from "../../settings/repositories/retention-policy.repository.js";
import { ExportJobRepository } from "../../settings/repositories/export-job.repository.js";
import { SupportSessionRepository } from "../repositories/support-session.repository.js";
import { PlatformLoginHistoryRepository } from "../repositories/platform-login-history.repository.js";
import { PlatformAuditRepository } from "../repositories/platform-audit.repository.js";

describe("PlatformComplianceService", () => {
  let service: PlatformComplianceService;
  let supportSessionRepository: jest.Mocked<SupportSessionRepository>;
  let loginHistoryRepository: jest.Mocked<PlatformLoginHistoryRepository>;
  let platformAuditRepository: jest.Mocked<PlatformAuditRepository>;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let retentionPolicyRepository: jest.Mocked<RetentionPolicyRepository>;
  let exportJobRepository: jest.Mocked<ExportJobRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformComplianceService,
        { provide: WorkspaceRepository, useValue: { countAll: jest.fn() } },
        { provide: RetentionPolicyRepository, useValue: { findAll: jest.fn() } },
        { provide: ExportJobRepository, useValue: { countByStatusAcrossWorkspaces: jest.fn() } },
        { provide: SupportSessionRepository, useValue: { list: jest.fn() } },
        {
          provide: PlatformLoginHistoryRepository,
          useValue: { countAll: jest.fn(), countFailed: jest.fn() },
        },
        { provide: PlatformAuditRepository, useValue: { list: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformComplianceService);
    supportSessionRepository = moduleRef.get(SupportSessionRepository);
    loginHistoryRepository = moduleRef.get(PlatformLoginHistoryRepository);
    platformAuditRepository = moduleRef.get(PlatformAuditRepository);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    retentionPolicyRepository = moduleRef.get(RetentionPolicyRepository);
    exportJobRepository = moduleRef.get(ExportJobRepository);
  });

  it("composes every widget from existing cross-tenant repository reads, no new persistence", async () => {
    supportSessionRepository.list
      .mockResolvedValueOnce({ items: [], total: 12 })
      .mockResolvedValueOnce({ items: [], total: 2 });
    loginHistoryRepository.countAll.mockResolvedValue(50);
    loginHistoryRepository.countFailed.mockResolvedValue(5);
    platformAuditRepository.list
      .mockResolvedValueOnce({ items: [], total: 3 }) // permission changes
      .mockResolvedValueOnce({ items: [], total: 200 }); // audit coverage
    workspaceRepository.countAll.mockResolvedValue(40);
    retentionPolicyRepository.findAll.mockResolvedValue(new Array(35).fill({}));
    exportJobRepository.countByStatusAcrossWorkspaces.mockResolvedValue({
      [ExportJobStatus.PENDING]: 1,
      [ExportJobStatus.PROCESSING]: 0,
      [ExportJobStatus.COMPLETED]: 10,
      [ExportJobStatus.FAILED]: 0,
    });

    const result = await service.getSnapshot();

    expect(result.breakGlassSessions).toEqual({ total: 12, active: 2 });
    expect(result.platformLogins).toEqual({ total: 50, successful: 45 });
    expect(result.failedLoginAttempts).toBe(5);
    expect(result.permissionChanges).toBe(3);
    expect(result.auditCoverage).toBe(200);
    expect(result.dataRetentionStatus).toEqual({ workspacesWithPolicy: 35, totalWorkspaces: 40 });
    expect(result.exportJobs[ExportJobStatus.COMPLETED]).toBe(10);
  });
});
