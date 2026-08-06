import { IsOptional, IsString } from "class-validator";

/** null/omitted unassigns — one endpoint (§19) covers both LEAD_ASSIGNED and LEAD_UNASSIGNED. */
export class AssignLeadDto {
  @IsOptional()
  @IsString()
  assignedUserId?: string | null;
}
