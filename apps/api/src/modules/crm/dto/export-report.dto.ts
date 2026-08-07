import { IsEnum } from "class-validator";
import { ReportsQueryDto } from "./reports-query.dto.js";

export enum ExportReportType {
  DASHBOARD = "dashboard",
  LEADS = "leads",
  DEALS = "deals",
  ACTIVITIES = "activities",
  TEAM_PERFORMANCE = "team-performance",
  FORECAST = "forecast",
}

export enum ExportFormat {
  CSV = "csv",
  EXCEL = "excel",
}

/** §12/§11 — GET /crm/reports/export?type=X&format=csv|excel (resolved 2026-08-07, Architecture Review). Inherits the same filters every other report endpoint accepts. */
export class ExportReportDto extends ReportsQueryDto {
  @IsEnum(ExportReportType)
  type!: ExportReportType;

  @IsEnum(ExportFormat)
  format!: ExportFormat;
}
