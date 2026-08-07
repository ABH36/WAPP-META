import type { PlanDocument } from "../schemas/plan.schema.js";
import type { SubscriptionDocument } from "../schemas/subscription.schema.js";
import type { PlanSummary, SubscriptionSummary } from "../billing.types.js";

export function toPlanSummary(plan: PlanDocument): PlanSummary {
  return {
    id: plan._id.toString(),
    name: plan.name,
    description: plan.description,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    currency: plan.currency,
    billingCycle: plan.billingCycle,
    isActive: plan.isActive,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export function toSubscriptionSummary(subscription: SubscriptionDocument): SubscriptionSummary {
  return {
    id: subscription._id.toString(),
    workspaceId: subscription.workspaceId,
    planId: subscription.planId.toString(),
    pendingPlanId: subscription.pendingPlanId ? subscription.pendingPlanId.toString() : null,
    status: subscription.status,
    startDate: subscription.startDate.toISOString(),
    renewalDate: subscription.renewalDate.toISOString(),
    trialEndsAt: subscription.trialEndsAt ? subscription.trialEndsAt.toISOString() : null,
    graceEndsAt: subscription.graceEndsAt ? subscription.graceEndsAt.toISOString() : null,
    cancelledAt: subscription.cancelledAt ? subscription.cancelledAt.toISOString() : null,
    billingCycle: subscription.billingCycle,
    autoRenew: subscription.autoRenew,
    createdBy: subscription.createdBy,
    updatedBy: subscription.updatedBy,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}
