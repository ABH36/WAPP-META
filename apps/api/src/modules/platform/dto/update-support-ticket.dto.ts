import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { SupportTicketStatus } from "../schemas/support-ticket.schema.js";

export class UpdateSupportTicketDto {
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @IsOptional()
  @IsString()
  assignedOperator?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  resolution?: string;
}
