import { IsOptional, IsString, MinLength } from "class-validator";

export class EndSupportSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}
