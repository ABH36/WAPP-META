import { IsBoolean, IsOptional } from "class-validator";

/** ADR-029 — only the user-configurable notifications. System notifications cannot be disabled. */
export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  taskFollowUpReminder?: boolean;

  @IsOptional()
  @IsBoolean()
  conversationLeadAssignment?: boolean;

  @IsOptional()
  @IsBoolean()
  broadcastCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  subscriptionReminder?: boolean;
}
