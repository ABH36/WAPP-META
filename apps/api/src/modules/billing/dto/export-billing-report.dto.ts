import { IsEnum } from "class-validator";

export enum ExportBillingReportType {
  DASHBOARD = "dashboard",
  SUBSCRIPTION = "subscription",
  INVOICES = "invoices",
  PAYMENTS = "payments",
  REVENUE = "revenue",
  USAGE = "usage",
}

export enum ExportFormat {
  CSV = "csv",
  EXCEL = "excel",
}

/** §Export — GET /billing/reports/export?type=X&format=csv|excel, same shape already established by CRM Reports' export DTO. */
export class ExportBillingReportDto {
  @IsEnum(ExportBillingReportType)
  type!: ExportBillingReportType;

  @IsEnum(ExportFormat)
  format!: ExportFormat;
}
