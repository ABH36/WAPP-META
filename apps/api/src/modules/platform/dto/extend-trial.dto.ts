import { IsInt, IsString, Max, Min, MinLength } from "class-validator";

/** §4.4/§10 — BR-003: reason is required; validation caps a single extension at 90 days. */
export class ExtendTrialDto {
  @IsInt()
  @Min(1)
  @Max(90)
  days!: number;

  @IsString()
  @MinLength(1, { message: "A reason is required to extend a trial" })
  reason!: string;
}
