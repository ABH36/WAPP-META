import { IsNotEmptyObject, IsObject, IsString, MinLength } from "class-validator";

/** BR-003 — "Governance Policy changes require justification." A reason under 10 characters ("fixing it") isn't a real justification — same MinLength precedent as Volume-3's RequestSupportAccessDto. */
export class UpdateGovernancePolicyDto {
  @IsObject()
  @IsNotEmptyObject()
  value!: Record<string, unknown>;

  @IsString()
  @MinLength(10)
  reason!: string;
}
