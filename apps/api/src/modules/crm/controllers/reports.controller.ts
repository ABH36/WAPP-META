import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { ReportsService } from "../services/reports.service.js";
import { ReportsQueryDto } from "../dto/reports-query.dto.js";
import { ExportReportDto } from "../dto/export-report.dto.js";
import type {
  ActivityReport,
  DashboardSummary,
  DealReport,
  ForecastReport,
  LeadReport,
  TeamPerformanceReport,
} from "../crm.types.js";

/**
 * PRD-004 Volume-6. Every route uses the same static `VIEW_REPORTS` gate
 * (resolved 2026-08-07, Architecture Review: workspace-wide, same as every
 * other permission in this codebase — the pre-scaffolded TEAM_SCOPED/
 * OWN_SCOPED/CAMPAIGN_SCOPED levels stay unenforced) — unlike
 * ActivityController, nothing here needs the per-instance inline pattern,
 * since reports aren't tied to one specific record. Read-only throughout
 * (BR-001/BR-002): no POST/PATCH/DELETE anywhere in this controller.
 */
@Controller({ path: "crm/reports", version: "1" })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @RequirePermission(Permission.VIEW_REPORTS)
  @Get("dashboard")
  async dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportsQueryDto,
  ): Promise<DashboardSummary> {
    return this.reportsService.getDashboard(user.workspaceId!, query);
  }

  @RequirePermission(Permission.VIEW_REPORTS)
  @Get("leads")
  async leads(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportsQueryDto,
  ): Promise<LeadReport> {
    return this.reportsService.getLeadReport(user.workspaceId!, query);
  }

  @RequirePermission(Permission.VIEW_REPORTS)
  @Get("deals")
  async deals(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportsQueryDto,
  ): Promise<DealReport> {
    return this.reportsService.getDealReport(user.workspaceId!, query);
  }

  @RequirePermission(Permission.VIEW_REPORTS)
  @Get("activities")
  async activities(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportsQueryDto,
  ): Promise<ActivityReport> {
    return this.reportsService.getActivityReport(user.workspaceId!, query);
  }

  @RequirePermission(Permission.VIEW_REPORTS)
  @Get("team-performance")
  async teamPerformance(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportsQueryDto,
  ): Promise<TeamPerformanceReport> {
    return this.reportsService.getTeamPerformance(user.workspaceId!, query);
  }

  @RequirePermission(Permission.VIEW_REPORTS)
  @Get("forecast")
  async forecast(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportsQueryDto,
  ): Promise<ForecastReport> {
    return this.reportsService.getForecast(user.workspaceId!, query);
  }

  // §11/§12 — binary response (CSV/Excel), so this bypasses the global
  // ResponseInterceptor's JSON envelope via @Res(), same precedent as
  // WebhookController's plain-text challenge response.
  @RequirePermission(Permission.VIEW_REPORTS)
  @Get("export")
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExportReportDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename, contentType } = await this.reportsService.exportReport(
      user.workspaceId!,
      query,
    );
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
