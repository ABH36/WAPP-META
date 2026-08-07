import { IsString } from "class-validator";

export class UpgradeSubscriptionDto {
  @IsString()
  planId!: string;
}
