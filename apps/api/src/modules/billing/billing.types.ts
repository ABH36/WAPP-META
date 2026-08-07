import type {
  BillingCycle,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionStatus,
} from "@wapp/shared-types";

export interface PlanSummary {
  id: string;
  name: string;
  description: string | null;
  // Nullable until GTM pricing is formally approved — TD-009, docs/TECH-DEBT.md.
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  currency: string;
  billingCycle: BillingCycle;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionSummary {
  id: string;
  workspaceId: string;
  planId: string;
  pendingPlanId: string | null;
  status: SubscriptionStatus;
  startDate: string;
  renewalDate: string;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  cancelledAt: string | null;
  billingCycle: BillingCycle;
  autoRenew: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceSummary {
  id: string;
  workspaceId: string;
  subscriptionId: string;
  invoiceNumber: string;
  // Nullable until GTM pricing/tax approval — TD-009/TD-011.
  amount: number | null;
  tax: number | null;
  currency: string;
  dueDate: string;
  issuedAt: string;
  paidAt: string | null;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSummary {
  id: string;
  workspaceId: string;
  invoiceId: string;
  gateway: string;
  gatewayReference: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt: string | null;
  refundedAt: string | null;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}
