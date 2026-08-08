import { IsIn } from "class-validator";
import { SubscriptionStatus } from "@wapp/shared-types";
import { OPERATOR_ASSIGNABLE_SUBSCRIPTION_STATUSES } from "../../billing/services/subscription.service.js";

/** §4.1/§9 — single generic status-transition endpoint covering Activate/Resume (ACTIVE), Suspend (SUSPENDED), Cancel (CANCELLED). */
export class UpdateSubscriptionStatusDto {
  @IsIn(OPERATOR_ASSIGNABLE_SUBSCRIPTION_STATUSES, {
    message: "status must be one of ACTIVE, SUSPENDED, or CANCELLED",
  })
  status!: SubscriptionStatus;
}
