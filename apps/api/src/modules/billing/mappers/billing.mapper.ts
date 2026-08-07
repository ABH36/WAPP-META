import type { PlanDocument } from "../schemas/plan.schema.js";
import type { SubscriptionDocument } from "../schemas/subscription.schema.js";
import type { InvoiceDocument } from "../schemas/invoice.schema.js";
import type { PaymentDocument } from "../schemas/payment.schema.js";
import type {
  InvoiceSummary,
  PaymentSummary,
  PlanSummary,
  SubscriptionSummary,
} from "../billing.types.js";

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

export function toInvoiceSummary(invoice: InvoiceDocument): InvoiceSummary {
  return {
    id: invoice._id.toString(),
    workspaceId: invoice.workspaceId,
    subscriptionId: invoice.subscriptionId.toString(),
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    tax: invoice.tax,
    currency: invoice.currency,
    dueDate: invoice.dueDate.toISOString(),
    issuedAt: invoice.issuedAt.toISOString(),
    paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    status: invoice.status,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

export function toPaymentSummary(payment: PaymentDocument): PaymentSummary {
  return {
    id: payment._id.toString(),
    workspaceId: payment.workspaceId,
    invoiceId: payment.invoiceId.toString(),
    gateway: payment.gateway,
    gatewayReference: payment.gatewayReference,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    refundedAt: payment.refundedAt ? payment.refundedAt.toISOString() : null,
    recordedBy: payment.recordedBy,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}
