import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import {
  CustomerStatus,
  DealStage,
  LeadStatus,
  TaskStatus,
  ActivityType,
} from "@wapp/shared-types";
import {
  QUALIFIED_OR_BEYOND_LEAD_STATUSES,
  ReportsRepository,
  type ReportsFilter,
} from "../repositories/reports.repository.js";
import type {
  ActivityReport,
  DashboardSummary,
  DealReport,
  ForecastReport,
  LeadReport,
  ReportsQueryOptions,
  StageValueEntry,
  TeamPerformanceEntry,
  TeamPerformanceReport,
} from "../crm.types.js";
import { ExportFormat, ExportReportType, type ExportReportDto } from "../dto/export-report.dto.js";

const OPEN_DEAL_STAGES: readonly DealStage[] = [
  DealStage.OPEN,
  DealStage.QUALIFICATION,
  DealStage.PROPOSAL,
  DealStage.NEGOTIATION,
];

const UPCOMING_FOLLOW_UP_WINDOW_DAYS = 7;

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

type ReportRow = Record<string, string | number>;

/**
 * PRD-004 Volume-6 (CRM Reports & Dashboard). Read-only (BR-001/BR-002),
 * nothing is ever persisted (BR-004) — every method here computes from the
 * current database state on each call (BR-006). Reports never own
 * Customer/Lead/Deal/Activity — see
 * docs/ADR-CRM-019-crm-reporting-strategy.md.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly reportsRepository: ReportsRepository) {}

  async getDashboard(workspaceId: string, options: ReportsQueryOptions): Promise<DashboardSummary> {
    const filter = this.toFilter(options);
    const now = new Date();
    const upcomingWindowEnd = new Date(
      now.getTime() + UPCOMING_FOLLOW_UP_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const [
      totalCustomers,
      activeCustomers,
      totalLeads,
      qualifiedLeads,
      wonLeads,
      lostLeads,
      totalDeals,
      openDeals,
      wonDeals,
      lostDeals,
      pipelineValue,
      forecastValue,
      overdueTasks,
      upcomingFollowUps,
    ] = await Promise.all([
      this.reportsRepository.countCustomers(workspaceId, filter),
      this.reportsRepository.countCustomersByStatus(workspaceId, CustomerStatus.ACTIVE, filter),
      this.reportsRepository.countLeads(workspaceId, filter),
      this.reportsRepository.countLeadsByStatus(workspaceId, LeadStatus.QUALIFIED, filter),
      this.reportsRepository.countLeadsByStatus(workspaceId, LeadStatus.WON, filter),
      this.reportsRepository.countLeadsByStatus(workspaceId, LeadStatus.LOST, filter),
      this.reportsRepository.countDeals(workspaceId, filter),
      this.reportsRepository.countDealsByStageIn(workspaceId, OPEN_DEAL_STAGES, filter),
      this.reportsRepository.countDealsByStageIn(workspaceId, [DealStage.WON], filter),
      this.reportsRepository.countDealsByStageIn(workspaceId, [DealStage.LOST], filter),
      this.reportsRepository.sumValueForStages(workspaceId, OPEN_DEAL_STAGES, filter),
      this.reportsRepository.sumForecastForStages(workspaceId, OPEN_DEAL_STAGES, filter),
      this.reportsRepository.countOverdueTasks(workspaceId, now, filter),
      this.reportsRepository.countUpcomingFollowUps(workspaceId, now, upcomingWindowEnd, filter),
    ]);

    return {
      totalCustomers,
      activeCustomers,
      totalLeads,
      qualifiedLeads,
      wonLeads,
      lostLeads,
      totalDeals,
      openDeals,
      wonDeals,
      lostDeals,
      pipelineValue,
      forecastValue,
      overdueTasks,
      upcomingFollowUps,
    };
  }

  async getLeadReport(workspaceId: string, options: ReportsQueryOptions): Promise<LeadReport> {
    const filter = this.toFilter(options);

    const [
      totalLeads,
      leadSourceDistribution,
      leadStatusDistribution,
      convertedCount,
      qualifiedOrBeyondCount,
      lostCount,
      averageQualificationTimeHours,
    ] = await Promise.all([
      this.reportsRepository.countLeads(workspaceId, filter),
      this.reportsRepository.groupLeadsBySource(workspaceId, filter),
      this.reportsRepository.groupLeadsByStatus(workspaceId, filter),
      this.reportsRepository.countConvertedLeads(workspaceId, filter),
      this.reportsRepository.countLeadsByStatusIn(
        workspaceId,
        QUALIFIED_OR_BEYOND_LEAD_STATUSES,
        filter,
      ),
      this.reportsRepository.countLeadsByStatus(workspaceId, LeadStatus.LOST, filter),
      this.reportsRepository.averageQualificationTimeHours(workspaceId, filter),
    ]);

    return {
      totalLeads,
      leadSourceDistribution,
      leadStatusDistribution,
      conversionRate: this.rate(convertedCount, totalLeads),
      qualificationRate: this.rate(qualifiedOrBeyondCount, totalLeads),
      lostRate: this.rate(lostCount, totalLeads),
      averageQualificationTimeHours,
    };
  }

  async getDealReport(workspaceId: string, options: ReportsQueryOptions): Promise<DealReport> {
    const filter = this.toFilter(options);

    const [
      totalDeals,
      dealStageDistribution,
      wonCount,
      lostCount,
      forecastRevenue,
      averageDealValue,
      averageSalesCycleHours,
    ] = await Promise.all([
      this.reportsRepository.countDeals(workspaceId, filter),
      this.reportsRepository.groupDealsByStage(workspaceId, filter),
      this.reportsRepository.countDealsByStageIn(workspaceId, [DealStage.WON], filter),
      this.reportsRepository.countDealsByStageIn(workspaceId, [DealStage.LOST], filter),
      this.reportsRepository.sumForecastForStages(workspaceId, OPEN_DEAL_STAGES, filter),
      this.reportsRepository.averageDealValue(workspaceId, filter),
      this.reportsRepository.averageSalesCycleHours(workspaceId, filter),
    ]);

    return {
      totalDeals,
      dealStageDistribution,
      wonCount,
      lostCount,
      // §6 "Revenue by Stage" — the same per-stage count/value breakdown as
      // the pipeline distribution; a second query would just repeat it.
      revenueByStage: dealStageDistribution,
      forecastRevenue,
      averageDealValue,
      averageSalesCycleHours,
    };
  }

  async getActivityReport(
    workspaceId: string,
    options: ReportsQueryOptions,
  ): Promise<ActivityReport> {
    const filter = this.toFilter(options);
    const now = new Date();

    const [
      activitiesByType,
      tasksPending,
      tasksCompleted,
      followUpsDue,
      notesCreated,
      callsLogged,
      meetingsLogged,
    ] = await Promise.all([
      this.reportsRepository.groupActivitiesByType(workspaceId, filter),
      this.reportsRepository.countTasksByStatus(workspaceId, TaskStatus.PENDING, filter),
      this.reportsRepository.countTasksByStatus(workspaceId, TaskStatus.COMPLETED, filter),
      this.reportsRepository.countFollowUpsDue(workspaceId, now, filter),
      this.reportsRepository.countActivitiesByType(workspaceId, ActivityType.NOTE, filter),
      this.reportsRepository.countActivitiesByType(workspaceId, ActivityType.CALL, filter),
      this.reportsRepository.countActivitiesByType(workspaceId, ActivityType.MEETING, filter),
    ]);

    return {
      activitiesByType,
      tasksPending,
      tasksCompleted,
      followUpsDue,
      notesCreated,
      callsLogged,
      meetingsLogged,
    };
  }

  async getTeamPerformance(
    workspaceId: string,
    options: ReportsQueryOptions,
  ): Promise<TeamPerformanceReport> {
    const filter = this.toFilter(options);

    const [dealsWon, leadsQualified, tasksCompleted, followUpsCompleted, averageDealCyclePerUser] =
      await Promise.all([
        this.reportsRepository.dealsWonPerUser(workspaceId, filter),
        this.reportsRepository.groupLeadsByAssigneeStatus(
          workspaceId,
          LeadStatus.QUALIFIED,
          filter,
        ),
        this.reportsRepository.tasksCompletedPerUser(workspaceId, filter),
        this.reportsRepository.followUpsCompletedPerUser(workspaceId, filter),
        this.reportsRepository.averageDealCyclePerUser(workspaceId, filter),
      ]);

    const entries = new Map<string, TeamPerformanceEntry>();
    const entryFor = (userId: string): TeamPerformanceEntry | null => {
      if (userId === "UNASSIGNED") return null;
      let entry = entries.get(userId);
      if (!entry) {
        entry = {
          userId,
          dealsWon: 0,
          leadsQualified: 0,
          tasksCompleted: 0,
          followUpsCompleted: 0,
          averageDealCycleHours: null,
        };
        entries.set(userId, entry);
      }
      return entry;
    };

    for (const row of dealsWon) {
      const entry = entryFor(row.key);
      if (entry) entry.dealsWon = row.count;
    }
    for (const row of leadsQualified) {
      const entry = entryFor(row.key);
      if (entry) entry.leadsQualified = row.count;
    }
    for (const row of tasksCompleted) {
      const entry = entryFor(row.key);
      if (entry) entry.tasksCompleted = row.count;
    }
    for (const row of followUpsCompleted) {
      const entry = entryFor(row.key);
      if (entry) entry.followUpsCompleted = row.count;
    }
    for (const row of averageDealCyclePerUser) {
      const entry = entryFor(row.userId);
      if (entry) entry.averageDealCycleHours = row.averageHours;
    }

    return { entries: Array.from(entries.values()) };
  }

  /** §9 — Deal data only, calculated dynamically, never persisted (BR-004). */
  async getForecast(workspaceId: string, options: ReportsQueryOptions): Promise<ForecastReport> {
    const filter = this.toFilter(options);

    const [pipelineForecast, monthlyForecast, quarterlyForecast, yearlyForecast] =
      await Promise.all([
        this.reportsRepository.sumForecastForStages(workspaceId, OPEN_DEAL_STAGES, filter),
        this.reportsRepository.groupForecastByPeriod(workspaceId, "month", filter),
        this.reportsRepository.groupForecastByPeriod(workspaceId, "quarter", filter),
        this.reportsRepository.groupForecastByPeriod(workspaceId, "year", filter),
      ]);

    return { pipelineForecast, monthlyForecast, quarterlyForecast, yearlyForecast };
  }

  /** §11/§12 — resolved 2026-08-07: type selects the report, format selects csv|excel. */
  async exportReport(workspaceId: string, dto: ExportReportDto): Promise<ExportResult> {
    const rows = await this.getReportRows(workspaceId, dto);
    const baseName = `${dto.type}-report`;

    if (dto.format === ExportFormat.EXCEL) {
      const buffer = await this.toExcelBuffer(rows, dto.type);
      return {
        buffer,
        filename: `${baseName}.xlsx`,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }

    return {
      buffer: Buffer.from(this.toCsv(rows), "utf-8"),
      filename: `${baseName}.csv`,
      contentType: "text/csv",
    };
  }

  private async getReportRows(workspaceId: string, dto: ExportReportDto): Promise<ReportRow[]> {
    switch (dto.type) {
      case ExportReportType.DASHBOARD:
        return this.dashboardToRows(await this.getDashboard(workspaceId, dto));
      case ExportReportType.LEADS:
        return this.leadReportToRows(await this.getLeadReport(workspaceId, dto));
      case ExportReportType.DEALS:
        return this.dealReportToRows(await this.getDealReport(workspaceId, dto));
      case ExportReportType.ACTIVITIES:
        return this.activityReportToRows(await this.getActivityReport(workspaceId, dto));
      case ExportReportType.TEAM_PERFORMANCE:
        return this.teamPerformanceToRows(await this.getTeamPerformance(workspaceId, dto));
      case ExportReportType.FORECAST:
        return this.forecastToRows(await this.getForecast(workspaceId, dto));
    }
  }

  private dashboardToRows(d: DashboardSummary): ReportRow[] {
    return [
      {
        "Total Customers": d.totalCustomers,
        "Active Customers": d.activeCustomers,
        "Total Leads": d.totalLeads,
        "Qualified Leads": d.qualifiedLeads,
        "Won Leads": d.wonLeads,
        "Lost Leads": d.lostLeads,
        "Total Deals": d.totalDeals,
        "Open Deals": d.openDeals,
        "Won Deals": d.wonDeals,
        "Lost Deals": d.lostDeals,
        "Pipeline Value": d.pipelineValue,
        "Forecast Value": d.forecastValue,
        "Overdue Tasks": d.overdueTasks,
        "Upcoming Follow-ups": d.upcomingFollowUps,
      },
    ];
  }

  private leadReportToRows(r: LeadReport): ReportRow[] {
    const rows: ReportRow[] = [
      { Section: "Summary", Metric: "Total Leads", Value: r.totalLeads },
      { Section: "Summary", Metric: "Conversion Rate (%)", Value: this.round2(r.conversionRate) },
      {
        Section: "Summary",
        Metric: "Qualification Rate (%)",
        Value: this.round2(r.qualificationRate),
      },
      { Section: "Summary", Metric: "Lost Rate (%)", Value: this.round2(r.lostRate) },
      {
        Section: "Summary",
        Metric: "Avg Qualification Time (hrs)",
        Value:
          r.averageQualificationTimeHours !== null
            ? this.round2(r.averageQualificationTimeHours)
            : "",
      },
    ];
    for (const e of r.leadSourceDistribution)
      rows.push({ Section: "Source", Metric: e.key, Value: e.count });
    for (const e of r.leadStatusDistribution)
      rows.push({ Section: "Status", Metric: e.key, Value: e.count });
    return rows;
  }

  private dealReportToRows(r: DealReport): ReportRow[] {
    const rows: ReportRow[] = [
      { Section: "Summary", Metric: "Total Deals", Value: r.totalDeals },
      { Section: "Summary", Metric: "Won", Value: r.wonCount },
      { Section: "Summary", Metric: "Lost", Value: r.lostCount },
      { Section: "Summary", Metric: "Forecast Revenue", Value: this.round2(r.forecastRevenue) },
      { Section: "Summary", Metric: "Average Deal Value", Value: this.round2(r.averageDealValue) },
      {
        Section: "Summary",
        Metric: "Average Sales Cycle (hrs)",
        Value: r.averageSalesCycleHours !== null ? this.round2(r.averageSalesCycleHours) : "",
      },
    ];
    for (const e of r.dealStageDistribution) {
      rows.push(this.stageRow(e));
    }
    return rows;
  }

  private stageRow(e: StageValueEntry): ReportRow {
    return { Section: "Stage", Metric: e.stage, Count: e.count, Value: this.round2(e.value) };
  }

  private activityReportToRows(r: ActivityReport): ReportRow[] {
    const rows: ReportRow[] = [
      { Section: "Summary", Metric: "Tasks Pending", Value: r.tasksPending },
      { Section: "Summary", Metric: "Tasks Completed", Value: r.tasksCompleted },
      { Section: "Summary", Metric: "Follow-ups Due", Value: r.followUpsDue },
      { Section: "Summary", Metric: "Notes Created", Value: r.notesCreated },
      { Section: "Summary", Metric: "Calls Logged", Value: r.callsLogged },
      { Section: "Summary", Metric: "Meetings Logged", Value: r.meetingsLogged },
    ];
    for (const e of r.activitiesByType)
      rows.push({ Section: "Type", Metric: e.key, Value: e.count });
    return rows;
  }

  private teamPerformanceToRows(r: TeamPerformanceReport): ReportRow[] {
    return r.entries.map((e) => ({
      "User ID": e.userId,
      "Deals Won": e.dealsWon,
      "Leads Qualified": e.leadsQualified,
      "Tasks Completed": e.tasksCompleted,
      "Follow-ups Completed": e.followUpsCompleted,
      "Average Deal Cycle (hrs)":
        e.averageDealCycleHours !== null ? this.round2(e.averageDealCycleHours) : "",
    }));
  }

  private forecastToRows(r: ForecastReport): ReportRow[] {
    const rows: ReportRow[] = [
      { Section: "Pipeline", Period: "Current", Value: this.round2(r.pipelineForecast) },
    ];
    for (const b of r.monthlyForecast)
      rows.push({ Section: "Monthly", Period: b.period, Value: this.round2(b.value) });
    for (const b of r.quarterlyForecast)
      rows.push({ Section: "Quarterly", Period: b.period, Value: this.round2(b.value) });
    for (const b of r.yearlyForecast)
      rows.push({ Section: "Yearly", Period: b.period, Value: this.round2(b.value) });
    return rows;
  }

  private toCsv(rows: ReportRow[]): string {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]!);
    const escape = (value: string | number): string => {
      const str = String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escape(row[header] ?? "")).join(",")),
    ];
    return lines.join("\n");
  }

  private async toExcelBuffer(rows: ReportRow[], sheetName: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]!);
      sheet.addRow(headers);
      for (const row of rows) {
        sheet.addRow(headers.map((header) => row[header] ?? ""));
      }
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private toFilter(options: ReportsQueryOptions): ReportsFilter {
    return {
      dateFrom: options.dateFrom ? new Date(options.dateFrom) : undefined,
      dateTo: options.dateTo ? new Date(options.dateTo) : undefined,
      assignedUserId: options.assignedUserId,
      customerId: options.customerId,
      dealStage: options.dealStage,
      leadStatus: options.leadStatus,
      leadSource: options.leadSource,
    };
  }

  private rate(count: number, total: number): number {
    return total > 0 ? this.round2((count / total) * 100) : 0;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
