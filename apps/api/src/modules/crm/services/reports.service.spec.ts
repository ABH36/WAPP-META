import { Test } from "@nestjs/testing";
import ExcelJS from "exceljs";
import { CustomerStatus, DealStage } from "@wapp/shared-types";
import { ReportsService } from "./reports.service.js";
import { ReportsRepository } from "../repositories/reports.repository.js";
import { ExportFormat, ExportReportType } from "../dto/export-report.dto.js";

describe("ReportsService", () => {
  let service: ReportsService;
  let repo: jest.Mocked<ReportsRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: ReportsRepository,
          useValue: {
            countCustomers: jest.fn(),
            countCustomersByStatus: jest.fn(),
            countLeads: jest.fn(),
            countLeadsByStatus: jest.fn(),
            countLeadsByStatusIn: jest.fn(),
            countConvertedLeads: jest.fn(),
            groupLeadsBySource: jest.fn(),
            groupLeadsByStatus: jest.fn(),
            averageQualificationTimeHours: jest.fn(),
            groupLeadsByAssigneeStatus: jest.fn(),
            countDeals: jest.fn(),
            countDealsByStageIn: jest.fn(),
            groupDealsByStage: jest.fn(),
            sumValueForStages: jest.fn(),
            sumForecastForStages: jest.fn(),
            averageDealValue: jest.fn(),
            averageSalesCycleHours: jest.fn(),
            groupForecastByPeriod: jest.fn(),
            dealsWonPerUser: jest.fn(),
            averageDealCyclePerUser: jest.fn(),
            countTasksByStatus: jest.fn(),
            countOverdueTasks: jest.fn(),
            countUpcomingFollowUps: jest.fn(),
            countFollowUpsDue: jest.fn(),
            countActivitiesByType: jest.fn(),
            groupActivitiesByType: jest.fn(),
            tasksCompletedPerUser: jest.fn(),
            followUpsCompletedPerUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ReportsService);
    repo = moduleRef.get(ReportsRepository);

    // Sensible zero defaults so tests only need to override what they check.
    repo.countCustomers.mockResolvedValue(0);
    repo.countCustomersByStatus.mockResolvedValue(0);
    repo.countLeads.mockResolvedValue(0);
    repo.countLeadsByStatus.mockResolvedValue(0);
    repo.countLeadsByStatusIn.mockResolvedValue(0);
    repo.countConvertedLeads.mockResolvedValue(0);
    repo.groupLeadsBySource.mockResolvedValue([]);
    repo.groupLeadsByStatus.mockResolvedValue([]);
    repo.averageQualificationTimeHours.mockResolvedValue(null);
    repo.groupLeadsByAssigneeStatus.mockResolvedValue([]);
    repo.countDeals.mockResolvedValue(0);
    repo.countDealsByStageIn.mockResolvedValue(0);
    repo.groupDealsByStage.mockResolvedValue([]);
    repo.sumValueForStages.mockResolvedValue(0);
    repo.sumForecastForStages.mockResolvedValue(0);
    repo.averageDealValue.mockResolvedValue(0);
    repo.averageSalesCycleHours.mockResolvedValue(null);
    repo.groupForecastByPeriod.mockResolvedValue([]);
    repo.dealsWonPerUser.mockResolvedValue([]);
    repo.averageDealCyclePerUser.mockResolvedValue([]);
    repo.countTasksByStatus.mockResolvedValue(0);
    repo.countOverdueTasks.mockResolvedValue(0);
    repo.countUpcomingFollowUps.mockResolvedValue(0);
    repo.countFollowUpsDue.mockResolvedValue(0);
    repo.countActivitiesByType.mockResolvedValue(0);
    repo.groupActivitiesByType.mockResolvedValue([]);
    repo.tasksCompletedPerUser.mockResolvedValue([]);
    repo.followUpsCompletedPerUser.mockResolvedValue([]);
  });

  describe("getDashboard", () => {
    it("assembles all dashboard fields from the repository", async () => {
      repo.countCustomers.mockResolvedValue(10);
      repo.countCustomersByStatus.mockResolvedValue(7);
      repo.countLeads.mockResolvedValue(20);
      repo.countDeals.mockResolvedValue(5);
      repo.countDealsByStageIn
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);
      repo.sumValueForStages.mockResolvedValue(150000);
      repo.sumForecastForStages.mockResolvedValue(45000);
      repo.countOverdueTasks.mockResolvedValue(4);
      repo.countUpcomingFollowUps.mockResolvedValue(2);

      const result = await service.getDashboard("workspace-1", {});

      expect(result.totalCustomers).toBe(10);
      expect(result.activeCustomers).toBe(7);
      expect(result.totalLeads).toBe(20);
      expect(result.totalDeals).toBe(5);
      expect(result.openDeals).toBe(3);
      expect(result.wonDeals).toBe(1);
      expect(result.lostDeals).toBe(1);
      expect(result.pipelineValue).toBe(150000);
      expect(result.forecastValue).toBe(45000);
      expect(result.overdueTasks).toBe(4);
      expect(result.upcomingFollowUps).toBe(2);
    });

    it("uses a 7-day window for Upcoming Follow-ups", async () => {
      await service.getDashboard("workspace-1", {});

      const [, now, windowEnd] = repo.countUpcomingFollowUps.mock.calls[0]!;
      const diffDays = (windowEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeCloseTo(7, 5);
    });

    it("passes the CustomerStatus.ACTIVE filter for activeCustomers", async () => {
      await service.getDashboard("workspace-1", {});

      expect(repo.countCustomersByStatus).toHaveBeenCalledWith(
        "workspace-1",
        CustomerStatus.ACTIVE,
        expect.anything(),
      );
    });
  });

  describe("getLeadReport", () => {
    it("computes conversion/qualification/lost rates as percentages", async () => {
      repo.countLeads.mockResolvedValue(50);
      repo.countConvertedLeads.mockResolvedValue(10);
      repo.countLeadsByStatusIn.mockResolvedValue(20);
      repo.countLeadsByStatus.mockResolvedValue(5);

      const result = await service.getLeadReport("workspace-1", {});

      expect(result.totalLeads).toBe(50);
      expect(result.conversionRate).toBe(20);
      expect(result.qualificationRate).toBe(40);
      expect(result.lostRate).toBe(10);
    });

    it("returns 0 rates when there are no Leads at all (no division by zero)", async () => {
      repo.countLeads.mockResolvedValue(0);

      const result = await service.getLeadReport("workspace-1", {});

      expect(result.conversionRate).toBe(0);
      expect(result.qualificationRate).toBe(0);
      expect(result.lostRate).toBe(0);
    });

    it("passes through a null averageQualificationTimeHours (no qualified Leads yet)", async () => {
      repo.averageQualificationTimeHours.mockResolvedValue(null);

      const result = await service.getLeadReport("workspace-1", {});

      expect(result.averageQualificationTimeHours).toBeNull();
    });
  });

  describe("getDealReport", () => {
    it("reuses the stage distribution as revenueByStage rather than a second query", async () => {
      const distribution = [{ stage: DealStage.OPEN, count: 3, value: 90000 }];
      repo.groupDealsByStage.mockResolvedValue(distribution);

      const result = await service.getDealReport("workspace-1", {});

      expect(result.dealStageDistribution).toBe(distribution);
      expect(result.revenueByStage).toBe(distribution);
    });
  });

  describe("getTeamPerformance", () => {
    it("merges per-metric distributions into one entry per user, keyed correctly", async () => {
      repo.dealsWonPerUser.mockResolvedValue([{ key: "user-1", count: 3 }]);
      repo.groupLeadsByAssigneeStatus.mockResolvedValue([
        { key: "user-1", count: 5 },
        { key: "user-2", count: 2 },
      ]);
      repo.tasksCompletedPerUser.mockResolvedValue([{ key: "user-2", count: 8 }]);
      repo.followUpsCompletedPerUser.mockResolvedValue([{ key: "user-1", count: 1 }]);
      repo.averageDealCyclePerUser.mockResolvedValue([{ userId: "user-1", averageHours: 48 }]);

      const result = await service.getTeamPerformance("workspace-1", {});

      const byUser = new Map(result.entries.map((e) => [e.userId, e]));
      expect(byUser.get("user-1")).toEqual({
        userId: "user-1",
        dealsWon: 3,
        leadsQualified: 5,
        tasksCompleted: 0,
        followUpsCompleted: 1,
        averageDealCycleHours: 48,
      });
      expect(byUser.get("user-2")).toEqual({
        userId: "user-2",
        dealsWon: 0,
        leadsQualified: 2,
        tasksCompleted: 8,
        followUpsCompleted: 0,
        averageDealCycleHours: null,
      });
    });

    it("excludes the UNASSIGNED bucket from team performance entries", async () => {
      repo.dealsWonPerUser.mockResolvedValue([{ key: "UNASSIGNED", count: 4 }]);

      const result = await service.getTeamPerformance("workspace-1", {});

      expect(result.entries).toHaveLength(0);
    });
  });

  describe("getForecast", () => {
    it("assembles pipeline/monthly/quarterly/yearly forecasts", async () => {
      repo.sumForecastForStages.mockResolvedValue(75000);
      repo.groupForecastByPeriod.mockImplementation((_ws, granularity) =>
        Promise.resolve(
          granularity === "month"
            ? [{ period: "2026-09", value: 20000 }]
            : granularity === "quarter"
              ? [{ period: "2026-Q3", value: 50000 }]
              : [{ period: "2026", value: 75000 }],
        ),
      );

      const result = await service.getForecast("workspace-1", {});

      expect(result.pipelineForecast).toBe(75000);
      expect(result.monthlyForecast).toEqual([{ period: "2026-09", value: 20000 }]);
      expect(result.quarterlyForecast).toEqual([{ period: "2026-Q3", value: 50000 }]);
      expect(result.yearlyForecast).toEqual([{ period: "2026", value: 75000 }]);
    });
  });

  describe("exportReport", () => {
    it("produces a CSV buffer with the dashboard fields as a header row", async () => {
      repo.countCustomers.mockResolvedValue(5);

      const result = await service.exportReport("workspace-1", {
        type: ExportReportType.DASHBOARD,
        format: ExportFormat.CSV,
      });

      expect(result.filename).toBe("dashboard-report.csv");
      expect(result.contentType).toBe("text/csv");
      const csv = result.buffer.toString("utf-8");
      expect(csv).toContain("Total Customers");
      expect(csv.split("\n")[1]).toContain("5");
    });

    it("produces a readable Excel workbook for the team-performance report", async () => {
      repo.dealsWonPerUser.mockResolvedValue([{ key: "user-1", count: 2 }]);

      const result = await service.exportReport("workspace-1", {
        type: ExportReportType.TEAM_PERFORMANCE,
        format: ExportFormat.EXCEL,
      });

      expect(result.filename).toBe("team-performance-report.xlsx");
      expect(result.contentType).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      const workbook = new ExcelJS.Workbook();
      // exceljs's own bundled @types/node declares a structurally-identical
      // but nominally distinct Buffer type from this workspace's — a
      // known transitive-dependency type-duplication quirk, not a real
      // type error. `Buffer` in this file's scope resolves to the same
      // (mismatched) type, so `as unknown as Buffer` doesn't help; `never`
      // is the only type assignable to both.
      await workbook.xlsx.load(result.buffer as never);
      const sheet = workbook.worksheets[0]!;
      expect(sheet.getRow(1).getCell(1).value).toBe("User ID");
      expect(sheet.getRow(2).getCell(1).value).toBe("user-1");
      expect(sheet.getRow(2).getCell(2).value).toBe(2);
    });

    it("produces an empty CSV without throwing when a report has no rows", async () => {
      const result = await service.exportReport("workspace-1", {
        type: ExportReportType.TEAM_PERFORMANCE,
        format: ExportFormat.CSV,
      });

      expect(result.buffer.toString("utf-8")).toBe("");
    });
  });
});
