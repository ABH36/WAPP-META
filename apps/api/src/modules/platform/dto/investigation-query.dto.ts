import { IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";

/** §4.5/§4.7 — workspaceId is mandatory: Investigation only ever runs inside an active Support Session for one specific workspace. */
export class InvestigationQueryDto {
  @IsString()
  workspaceId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
