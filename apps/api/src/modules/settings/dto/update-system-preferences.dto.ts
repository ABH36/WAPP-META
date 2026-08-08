import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { ExportFormat } from "../schemas/export-job.schema.js";

export class UpdateSystemPreferencesDto {
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(200)
  defaultPagination?: number;

  @IsOptional()
  @IsEnum(ExportFormat)
  exportFormat?: ExportFormat;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(3600)
  dashboardRefreshInterval?: number;
}
