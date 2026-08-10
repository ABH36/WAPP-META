import { Test } from "@nestjs/testing";
import { PlatformKpisService } from "./platform-kpis.service.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { CustomerRepository } from "../../crm/repositories/customer.repository.js";
import { BillingReportsService } from "../../billing/services/billing-reports.service.js";
import { FeatureFlagRepository } from "../../settings/repositories/feature-flag.repository.js";
import { FeatureFlagKey } from "../../settings/schemas/feature-flag-state.schema.js";
import { SupportTicketRepository } from "../repositories/support-ticket.repository.js";
import { PlatformAuditRepository } from "../repositories/platform-audit.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { PlatformAuditEntryDocument } from "../schemas/platform-audit-entry.schema.js";

function fakeAuditEntry(eventType: string, occurredAt: Date): PlatformAuditEntryDocument {
  return { eventType, occurredAt } as unknown as PlatformAuditEntryDocument;
}

describe("PlatformKpisService", () => {
  let service: PlatformKpisService;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let customerRepository: jest.Mocked<CustomerRepository>;
  let billingReportsService: jest.Mocked<BillingReportsService>;
  let featureFlagRepository: jest.Mocked<FeatureFlagRepository>;
  let supportTicketRepository: jest.Mocked<SupportTicketRepository>;
  let platformAuditRepository: jest.Mocked<PlatformAuditRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformKpisService,
        {
          provide: WorkspaceRepository,
          useValue: { countAll: jest.fn(), countCreatedSince: jest.fn() },
        },
        {
          provide: CustomerRepository,
          useValue: { countAll: jest.fn(), countCreatedSince: jest.fn() },
        },
        { provide: BillingReportsService, useValue: { getPlatformRevenueInRange: jest.fn() } },
        { provide: FeatureFlagRepository, useValue: { countEnabledAcrossWorkspaces: jest.fn() } },
        { provide: SupportTicketRepository, useValue: { getAverageResolutionHours: jest.fn() } },
        { provide: PlatformAuditRepository, useValue: { findByEventTypesAscending: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformKpisService);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    customerRepository = moduleRef.get(CustomerRepository);
    billingReportsService = moduleRef.get(BillingReportsService);
    featureFlagRepository = moduleRef.get(FeatureFlagRepository);
    supportTicketRepository = moduleRef.get(SupportTicketRepository);
    platformAuditRepository = moduleRef.get(PlatformAuditRepository);
  });

  it("computes Workspace/Customer/Revenue Growth from live cross-tenant reads", async () => {
    workspaceRepository.countAll.mockResolvedValue(50);
    workspaceRepository.countCreatedSince.mockResolvedValue(4);
    customerRepository.countAll.mockResolvedValue(300);
    customerRepository.countCreatedSince.mockResolvedValue(20);
    billingReportsService.getPlatformRevenueInRange
      .mockResolvedValueOnce(80000)
      .mockResolvedValueOnce(70000);
    supportTicketRepository.getAverageResolutionHours.mockResolvedValue(6.5);
    platformAuditRepository.findByEventTypesAscending.mockResolvedValue([]);
    featureFlagRepository.countEnabledAcrossWorkspaces.mockResolvedValue(25);

    const result = await service.getSnapshot();

    expect(result.workspaceGrowth).toEqual({ newThisMonth: 4, totalWorkspaces: 50 });
    expect(result.customerGrowth).toEqual({ newThisMonth: 20, totalCustomers: 300 });
    expect(result.revenueGrowth).toEqual({ currentMonth: 80000, previousMonth: 70000 });
    expect(result.supportResolutionTimeHours).toBe(6.5);
  });

  it("reports 100% Platform Availability with no maintenance history and labels the metric as application-level", async () => {
    workspaceRepository.countAll.mockResolvedValue(10);
    workspaceRepository.countCreatedSince.mockResolvedValue(0);
    customerRepository.countAll.mockResolvedValue(0);
    customerRepository.countCreatedSince.mockResolvedValue(0);
    billingReportsService.getPlatformRevenueInRange.mockResolvedValue(0);
    supportTicketRepository.getAverageResolutionHours.mockResolvedValue(null);
    platformAuditRepository.findByEventTypesAscending.mockResolvedValue([]);
    featureFlagRepository.countEnabledAcrossWorkspaces.mockResolvedValue(0);

    const result = await service.getSnapshot();

    expect(result.platformAvailability.percentageUptime).toBe(100);
    expect(result.platformAvailability.note).toContain("not infrastructure uptime");
  });

  it("computes downtime from a closed maintenance window as less than 100% uptime", async () => {
    workspaceRepository.countAll.mockResolvedValue(10);
    workspaceRepository.countCreatedSince.mockResolvedValue(0);
    customerRepository.countAll.mockResolvedValue(0);
    customerRepository.countCreatedSince.mockResolvedValue(0);
    billingReportsService.getPlatformRevenueInRange.mockResolvedValue(0);
    supportTicketRepository.getAverageResolutionHours.mockResolvedValue(null);
    featureFlagRepository.countEnabledAcrossWorkspaces.mockResolvedValue(0);

    const windowStart = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
    const enabledAt = new Date(windowStart.getTime());
    const disabledAt = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000); // 1 day of downtime
    platformAuditRepository.findByEventTypesAscending.mockResolvedValue([
      fakeAuditEntry(DomainEvent.PLATFORM_MAINTENANCE_ENABLED, enabledAt),
      fakeAuditEntry(DomainEvent.PLATFORM_MAINTENANCE_DISABLED, disabledAt),
    ]);

    const result = await service.getSnapshot();

    expect(result.platformAvailability.percentageUptime).toBeLessThan(100);
    expect(result.platformAvailability.percentageUptime).toBeGreaterThan(90);
  });

  it("computes Feature Adoption as a percentage per flag key, one entry per known flag", async () => {
    workspaceRepository.countAll.mockResolvedValue(20);
    workspaceRepository.countCreatedSince.mockResolvedValue(0);
    customerRepository.countAll.mockResolvedValue(0);
    customerRepository.countCreatedSince.mockResolvedValue(0);
    billingReportsService.getPlatformRevenueInRange.mockResolvedValue(0);
    supportTicketRepository.getAverageResolutionHours.mockResolvedValue(null);
    platformAuditRepository.findByEventTypesAscending.mockResolvedValue([]);
    featureFlagRepository.countEnabledAcrossWorkspaces.mockResolvedValue(10);

    const result = await service.getSnapshot();

    expect(result.featureAdoption).toHaveLength(Object.values(FeatureFlagKey).length);
    expect(result.featureAdoption.every((entry) => entry.adoptionPercentage === 50)).toBe(true);
  });
});
