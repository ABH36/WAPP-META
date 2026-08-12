import type { SubscriptionStatus } from "@wapp/shared-types";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { InvoiceSummary, PaymentSummary, SubscriptionSummary } from "../types/platform";
import type { PlatformPaginated } from "../types/pagination";

interface ListByWorkspaceParams {
  workspaceId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface RecordPaymentPayload {
  workspaceId: string;
  invoiceId: string;
  gateway: string;
  gatewayReference: string;
  amount: number;
  currency: string;
  outcome: "PAID" | "FAILED";
  verified?: boolean;
  evidenceUrl?: string;
}

/**
 * FRD-001 Volume-8 §4.4 — `VIEW_PLATFORM_BILLING` for reads,
 * `MANAGE_TRIALS`/`MANAGE_SUBSCRIPTIONS`/`MANAGE_PAYMENTS` for writes (all
 * `PLATFORM_SUPER_ADMIN`-only). `updateSubscriptionStatus` is one generic
 * route covering Activate/Resume (`ACTIVE`) and Suspend/Cancel — there is
 * no way to distinguish "Activate" from "Resume" intent server-side, both
 * are the same call. `updatePlan`'s `immediate` flag mirrors the tenant
 * Subscription screen's own Upgrade(now)/Downgrade(at renewal) split.
 */
export const billingOperationsService = {
  listSubscriptions(
    params: ListByWorkspaceParams,
  ): Promise<PlatformPaginated<SubscriptionSummary>> {
    return apiGet("/platform/subscriptions", params as Record<string, unknown>);
  },

  getSubscription(id: string): Promise<SubscriptionSummary> {
    return apiGet(`/platform/subscriptions/${id}`);
  },

  extendTrial(id: string, days: number, reason: string): Promise<SubscriptionSummary> {
    return apiPatch(`/platform/subscriptions/${id}/trial`, { days, reason });
  },

  updatePlan(id: string, planId: string, immediate: boolean): Promise<SubscriptionSummary> {
    return apiPatch(`/platform/subscriptions/${id}/plan`, { planId, immediate });
  },

  updateSubscriptionStatus(id: string, status: SubscriptionStatus): Promise<SubscriptionSummary> {
    return apiPatch(`/platform/subscriptions/${id}/status`, { status });
  },

  listInvoices(params: ListByWorkspaceParams): Promise<PlatformPaginated<InvoiceSummary>> {
    return apiGet("/platform/invoices", params as Record<string, unknown>);
  },

  getInvoice(id: string): Promise<InvoiceSummary> {
    return apiGet(`/platform/invoices/${id}`);
  },

  voidInvoice(id: string, reason: string): Promise<InvoiceSummary> {
    return apiPatch(`/platform/invoices/${id}/void`, { reason });
  },

  listPayments(params: ListByWorkspaceParams): Promise<PlatformPaginated<PaymentSummary>> {
    return apiGet("/platform/payments", params as Record<string, unknown>);
  },

  recordPayment(payload: RecordPaymentPayload): Promise<PaymentSummary> {
    return apiPost("/platform/payments/manual", payload);
  },

  refundPayment(id: string, reason: string): Promise<PaymentSummary> {
    return apiPost(`/platform/payments/${id}/refund`, { reason });
  },
};
