import { IsEnum, IsOptional } from "class-validator";
import { DealLostReason, DealStage } from "@wapp/shared-types";

/** BR-007 — lostReason is validated as required-when-LOST in DealService, not here (class-validator can't express a conditional-required rule declaratively without a custom decorator). */
export class UpdateDealStageDto {
  @IsEnum(DealStage)
  stage!: DealStage;

  @IsOptional()
  @IsEnum(DealLostReason)
  lostReason?: DealLostReason;
}
