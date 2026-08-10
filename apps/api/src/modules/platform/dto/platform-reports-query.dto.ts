import { IsEnum, IsISO8601, IsOptional } from "class-validator";

export enum PlatformReportType {
  WORKSPACE = "WORKSPACE",
  BILLING = "BILLING",
  PLATFORM_ACTIVITY = "PLATFORM_ACTIVITY",
  SUPPORT_OPERATIONS = "SUPPORT_OPERATIONS",
  BREAK_GLASS = "BREAK_GLASS",
  COMPLIANCE = "COMPLIANCE",
}

export enum PlatformReportFormat {
  CSV = "CSV",
  EXCEL = "EXCEL",
}

export class PlatformReportsQueryDto {
  @IsEnum(PlatformReportType)
  type!: PlatformReportType;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

/** §10 — "Exports: Maximum date range 365 days" is enforced in PlatformReportsService.exportReport(), not here (a cross-field range check reads more clearly as a service-level guard than a class-validator custom constraint, matching this codebase's existing style — no other DTO in this codebase uses a cross-field @Validate). */
export class PlatformReportsExportQueryDto extends PlatformReportsQueryDto {
  @IsEnum(PlatformReportFormat)
  format!: PlatformReportFormat;
}
