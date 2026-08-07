import { IsOptional, IsString } from "class-validator";

/** §11 — shared by both /crm/tasks/:id/assign and /crm/follow-ups/:id/assign. null/omitted unassigns. */
export class AssignActivityDto {
  @IsOptional()
  @IsString()
  assignedUserId?: string | null;
}
