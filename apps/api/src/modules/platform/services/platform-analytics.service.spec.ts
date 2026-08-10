import { Test } from "@nestjs/testing";
import { PlatformAnalyticsService } from "./platform-analytics.service.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { LeadRepository } from "../../crm/repositories/lead.repository.js";
import { DealRepository } from "../../crm/repositories/deal.repository.js";
import { CustomerRepository } from "../../crm/repositories/customer.repository.js";
import { MessageRepository } from "../../communication/repositories/message.repository.js";
import { BillingReportsService } from "../../billing/services/billing-reports.service.js";
import { PlatformUserRepository } from "../repositories/platform-user.repository.js";
import { PlatformSessionRepository } from "../repositories/platform-session.repository.js";

describe("PlatformAnalyticsService", () => {
  let service: PlatformAnalyticsService;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let platformUserRepository: jest.Mocked<PlatformUserRepository>;
  let platformSessionRepository: jest.Mocked<PlatformSessionRepository>;
  let billingReportsService: jest.Mocked<BillingReportsService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformAnalyticsService,
        {
          provide: WorkspaceRepository,
          useValue: { countAll: jest.fn(), countByStatus: jest.fn() },
        },
        { provide: LeadRepository, useValue: { countAll: jest.fn() } },
        { provide: DealRepository, useValue: { countAll: jest.fn() } },
        { provide: CustomerRepository, useValue: { countAll: jest.fn() } },
        { provide: MessageRepository, useValue: { countAll: jest.fn() } },
        { provide: BillingReportsService, useValue: { getPlatformRevenueTotal: jest.fn() } },
        { provide: PlatformUserRepository, useValue: { countAll: jest.fn() } },
        { provide: PlatformSessionRepository, useValue: { countActive: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformAnalyticsService);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    platformUserRepository = moduleRef.get(PlatformUserRepository);
    platformSessionRepository = moduleRef.get(PlatformSessionRepository);
    billingReportsService = moduleRef.get(BillingReportsService);
  });

  it("composes every metric from existing cross-tenant repository methods, excluding Storage/API Usage", async () => {
    workspaceRepository.countAll.mockResolvedValue(42);
    workspaceRepository.countByStatus.mockResolvedValueOnce(38).mockResolvedValueOnce(2);
    platformUserRepository.countAll.mockResolvedValue(6);
    platformSessionRepository.countActive.mockResolvedValue(3);
    billingReportsService.getPlatformRevenueTotal.mockResolvedValue(150000);

    const result = await service.getSnapshot();

    expect(result.totalWorkspaces).toBe(42);
    expect(result.activeWorkspaces).toBe(38);
    expect(result.archivedWorkspaces).toBe(2);
    expect(result.platformUsers).toBe(6);
    expect(result.activePlatformSessions).toBe(3);
    expect(result.revenueSummary.totalRevenue).toBe(150000);
    expect(result).not.toHaveProperty("storageUsage");
    expect(result).not.toHaveProperty("apiUsage");
  });
});
