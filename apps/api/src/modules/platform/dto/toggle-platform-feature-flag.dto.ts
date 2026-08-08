import { IsBoolean } from "class-validator";

export class TogglePlatformFeatureFlagDto {
  @IsBoolean()
  enabled!: boolean;
}
