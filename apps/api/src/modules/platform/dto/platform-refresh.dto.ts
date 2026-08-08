import { IsString, MinLength } from "class-validator";

export class PlatformRefreshDto {
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}
