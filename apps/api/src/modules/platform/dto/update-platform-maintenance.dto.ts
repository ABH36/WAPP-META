import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

/** §10 — Platform Maintenance is a boolean; a reason is optional context for the announcement banner. */
export class UpdatePlatformMaintenanceDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
