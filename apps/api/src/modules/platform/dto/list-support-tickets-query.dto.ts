import { IsEnum, IsOptional, IsString } from "class-validator";
import { SupportTicketPriority, SupportTicketStatus } from "../schemas/support-ticket.schema.js";

export class ListSupportTicketsQueryDto {
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @IsOptional()
  @IsString()
  assignedOperator?: string;
}
