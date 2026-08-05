import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";
import { AssignmentStrategy } from "../schemas/automation-settings.schema.js";

export class UpdateAutomationSettingsDto {
  @IsOptional()
  @IsBoolean()
  welcomeMessageEnabled?: boolean;

  // Omitted = leave unchanged; null = explicitly clear the configured text.
  @IsOptional()
  @ValidateIf((dto: UpdateAutomationSettingsDto) => dto.welcomeMessageText !== null)
  @IsString()
  @MaxLength(4096)
  welcomeMessageText?: string | null;

  @IsOptional()
  @IsBoolean()
  awayMessageEnabled?: boolean;

  @IsOptional()
  @ValidateIf((dto: UpdateAutomationSettingsDto) => dto.awayMessageText !== null)
  @IsString()
  @MaxLength(4096)
  awayMessageText?: string | null;

  // roundRobinLastAssignedUserId is deliberately not settable here — it's
  // AutoAssignmentService's own internal rotation state, not a user setting.
  @IsOptional()
  @IsEnum(AssignmentStrategy)
  assignmentStrategy?: AssignmentStrategy;
}
