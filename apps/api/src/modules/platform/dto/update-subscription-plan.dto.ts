import { IsBoolean, IsString } from "class-validator";

/** §4.1/§9 — immediate=true delegates to Billing's upgrade() (applies now); immediate=false delegates to downgrade() (queued until renewal), matching the tenant SubscriptionController's own Upgrade/Downgrade split. */
export class UpdateSubscriptionPlanDto {
  @IsString()
  planId!: string;

  @IsBoolean()
  immediate!: boolean;
}
