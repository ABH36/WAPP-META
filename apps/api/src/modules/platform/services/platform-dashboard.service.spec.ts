import { Test } from "@nestjs/testing";
import { WorkspaceStatus } from "@wapp/shared-types";
import { PlatformDashboardService } from "./platform-dashboard.service.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { LeadRepository } from "../../crm/repositories/lead.repository.js";
import { DealRepository } from "../../crm/repositories/deal.repository.js";
import { MessageRepository } from "../../communication/repositories/message.repository.js";
import { BillingReportsService } from "../../billing/services/billing-reports.service.js";
import { HealthCheckService } from "../../../health/health-check.service.js";

describe("PlatformDashboardService", () => {
  let service: PlatformDashboardService;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let leadRepository: jest.Mocked<LeadRepository>;
  let dealRepository: jest.Mocked<DealRepository>;
  let messageRepository: jest.Mocked<MessageRepository>;
  let billingReportsService: jest.Mocked<BillingReportsService>;
  let healthCheckService: jest.Mocked<HealthCheckService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformDashboardService,
        {
          provide: WorkspaceRepository,
          useValue: { countAll: jest.fn(), countByStatus: jest.fn() },
        },
        { provide: UserRepository, useValue: { countAll: jest.fn() } },
        { provide: LeadRepository, useValue: { countAll: jest.fn() } },
        { provide: DealRepository, useValue: { countAll: jest.fn() } },
        { provide: MessageRepository, useValue: { countAll: jest.fn() } },
        { provide: BillingReportsService, useValue: { getPlatformRevenueTotal: jest.fn() } },
        { provide: HealthCheckService, useValue: { getChecks: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformDashboardService);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    userRepository = moduleRef.get(UserRepository);
    leadRepository = moduleRef.get(LeadRepository);
    dealRepository = moduleRef.get(DealRepository);
    messageRepository = moduleRef.get(MessageRepository);
    billingReportsService = moduleRef.get(BillingReportsService);
    healthCheckService = moduleRef.get(HealthCheckService);

    workspaceRepository.countAll.mockResolvedValue(42);
    workspaceRepository.countByStatus.mockImplementation((status) =>
      Promise.resolve(status === WorkspaceStatus.ACTIVE ? 30 : 2),
    );
    userRepository.countAll.mockResolvedValue(200);
    leadRepository.countAll.mockResolvedValue(50);
    dealRepository.countAll.mockResolvedValue(20);
    messageRepository.countAll.mockResolvedValue(1000);
    billingReportsService.getPlatformRevenueTotal.mockResolvedValue(50000);
    healthCheckService.getChecks.mockResolvedValue({
      database: true,
      redis: true,
      queue: true,
      storage: true,
      email: true,
    });
  });

  it("aggregates cross-tenant counts, revenue, and system health in one snapshot", async () => {
    const result = await service.getSnapshot();

    expect(result.workspaces.total).toBe(42);
    expect(result.workspaces.byStatus[WorkspaceStatus.ACTIVE]).toBe(30);
    expect(result.workspaces.byStatus[WorkspaceStatus.SUSPENDED]).toBe(2);
    expect(result.totalUsers).toBe(200);
    expect(result.totalLeads).toBe(50);
    expect(result.totalDeals).toBe(20);
    expect(result.totalMessages).toBe(1000);
    expect(result.totalRevenue).toBe(50000);
    expect(result.systemHealth.database).toBe(true);
  });

  it("includes a count for every WorkspaceStatus value, including ARCHIVED", async () => {
    const result = await service.getSnapshot();

    expect(Object.keys(result.workspaces.byStatus).sort()).toEqual(
      Object.values(WorkspaceStatus).sort(),
    );
  });
});
