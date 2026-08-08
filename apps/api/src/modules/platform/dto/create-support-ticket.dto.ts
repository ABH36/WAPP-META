import { IsEnum, IsString, MaxLength, MinLength } from "class-validator";
import { SupportTicketCategory, SupportTicketPriority } from "../schemas/support-ticket.schema.js";

/** §10 — Title mandatory. */
export class CreateSupportTicketDto {
  @IsString()
  workspaceId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsEnum(SupportTicketCategory)
  category!: SupportTicketCategory;

  @IsEnum(SupportTicketPriority)
  priority!: SupportTicketPriority;
}
