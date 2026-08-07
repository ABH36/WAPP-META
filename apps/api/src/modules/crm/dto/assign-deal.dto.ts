import { IsOptional, IsString } from "class-validator";

/** null/omitted unassigns — one endpoint covers both DEAL_ASSIGNED and DEAL_UNASSIGNED, same pattern as AssignLeadDto. */
export class AssignDealDto {
  @IsOptional()
  @IsString()
  assignedTo?: string | null;
}
