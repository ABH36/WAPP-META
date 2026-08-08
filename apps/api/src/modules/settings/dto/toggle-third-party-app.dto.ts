import { IsBoolean } from "class-validator";

export class ToggleThirdPartyAppDto {
  @IsBoolean()
  enabled!: boolean;
}
