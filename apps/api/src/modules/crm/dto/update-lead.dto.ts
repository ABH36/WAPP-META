import { IsEmail, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

/**
 * PRD-004 Volume-2 — mobileNumber, contactId, customerId, source, status,
 * and assignedUserId are deliberately absent here: mobileNumber/source are
 * immutable after creation (BR-003/BR-004), status changes go through the
 * dedicated /status endpoint, and assignment goes through /assign.
 */
export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  leadName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
