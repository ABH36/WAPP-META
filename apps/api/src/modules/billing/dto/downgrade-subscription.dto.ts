import { IsString } from "class-validator";

export class DowngradeSubscriptionDto {
  @IsString()
  planId!: string;
}
