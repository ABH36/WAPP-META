import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

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
}
