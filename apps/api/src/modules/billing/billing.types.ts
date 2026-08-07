import type {
  BillingCycle,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionStatus,
  UsageCounterType,
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

export interface EntitlementsSummary {
  crm: boolean;
  broadcast: boolean;
  campaigns: boolean;
  automation: boolean;
  teamMembers: boolean;
  reports: boolean;
  apiAccess: boolean;
  webhooks: boolean;
  integrations: boolean;
}

export interface UsageLimitsByCounter {
  teamMembers: number | null;
  customers: number | null;
  leads: number | null;
  deals: number | null;
  broadcasts: number | null;
  // Nullable and never populated in this volume — TD-013 (no creation-time
  // event exists to count Campaigns; Storage/API Requests likewise deferred).
  campaigns: number | null;
  messages: number | null;
  storage: number | null;
  apiRequests: number | null;
}

export interface PlanLimitsSummary {
  planId: string;
  entitlements: EntitlementsSummary;
  limits: UsageLimitsByCounter;
}

export interface CounterUsageSummary {
  counterType: UsageCounterType;
  count: number;
  // Null means either "unlimited" is not yet a real possibility (limit not
  // yet approved, TD-014) or the counter itself is deferred (TD-013) — both
  // read the same way to a client: nothing to warn about yet.
  limit: number | null;
  percentage: number | null;
  locked: boolean;
}

export interface UsageSummary {
  workspaceId: string;
  counters: CounterUsageSummary[];
}

export interface UsageHistoryEntrySummary {
  id: string;
  workspaceId: string;
  eventType: string;
  description: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}
