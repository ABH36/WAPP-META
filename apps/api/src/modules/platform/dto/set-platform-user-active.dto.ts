import { IsBoolean } from "class-validator";

export class SetPlatformUserActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
