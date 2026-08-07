import { IsDateString, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

/**
 * PRD-004 Volume-4 — contactId, customerId, sourceLeadId, stage, assignedTo,
 * wonAt, lostAt, and lostReason are deliberately absent here: identity
 * (BR-003/§18) is immutable after creation, stage changes go through the
 * dedicated /stage endpoint (which also owns wonAt/lostAt/lostReason), and
 * assignment goes through /assign.
 */
export class UpdateDealDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  // BR-005 — not auto-derived from stage; see deal.schema.ts's doc comment.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  probability?: number;

  // BR-008 — may change at any time; history isn't specially tracked beyond
  // the normal updatedAt/updatedBy audit trail every CRM entity already has.
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;
}
