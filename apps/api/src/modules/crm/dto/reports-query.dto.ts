import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { DealStage, LeadSource, LeadStatus } from "@wapp/shared-types";

/** PRD-004 Volume-6 §10 — global filters. Each report endpoint applies only the filters relevant to its own entity (e.g. dealStage is ignored by the Lead report). */
export class ReportsQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsEnum(DealStage)
  dealStage?: DealStage;

  @IsOptional()
  @IsEnum(LeadStatus)
  leadStatus?: LeadStatus;

  @IsOptional()
  @IsEnum(LeadSource)
  leadSource?: LeadSource;
}
