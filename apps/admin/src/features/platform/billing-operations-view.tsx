"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  InvoiceStatus,
  PaymentStatus,
  PlatformPermission,
  SubscriptionStatus,
} from "@wapp/shared-types";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  InvoiceCard,
  PaymentCard,
  Select,
  SkeletonCard,
  StageBadge,
} from "@wapp/ui";
import { billingOperationsService } from "../../services/billing-operations.service";
import { useHasFullPlatformPermission, useHasPlatformPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";

type Tab = "subscriptions" | "invoices" | "payments";

const EMPTY_PAYMENT_FORM = {
  workspaceId: "",
  invoiceId: "",
  gateway: "",
  gatewayReference: "",
  amount: 0,
  currency: "INR",
  outcome: "PAID" as "PAID" | "FAILED",
};

/**
 * FRD-001 Volume-8 §4.4 — Billing Operations. `VIEW_PLATFORM_BILLING` for
 * reads (all 3 roles), `MANAGE_TRIALS`/`MANAGE_SUBSCRIPTIONS`/
 * `MANAGE_PAYMENTS` for writes (`PLATFORM_SUPER_ADMIN`-only). Reuses the
 * exact `InvoiceCard`/`PaymentCard` primitives Billing's own Volume-6
 * built (`gateway`/`amount`/`status`/... shapes are identical — the
 * platform routes read/write the same collections). Activate and Resume
 * share one route (`status: "ACTIVE"`) — no way to distinguish operator
 * intent server-side.
 */
export function BillingOperationsView(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPlatformPermission(PlatformPermission.VIEW_PLATFORM_BILLING);
  const canManageTrials = useHasFullPlatformPermission(PlatformPermission.MANAGE_TRIALS);
  const canManageSubscriptions = useHasFullPlatformPermission(
    PlatformPermission.MANAGE_SUBSCRIPTIONS,
  );
  const canManagePayments = useHasFullPlatformPermission(PlatformPermission.MANAGE_PAYMENTS);
  const [tab, setTab] = React.useState<Tab>("subscriptions");
  const [workspaceId, setWorkspaceId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [trialForm, setTrialForm] = React.useState<{
    id: string;
    days: number;
    reason: string;
  } | null>(null);
  const [planForm, setPlanForm] = React.useState<{
    id: string;
    planId: string;
    immediate: boolean;
  } | null>(null);
  const [voidForm, setVoidForm] = React.useState<{ id: string; reason: string } | null>(null);
  const [refundForm, setRefundForm] = React.useState<{ id: string; reason: string } | null>(null);
  const [showPaymentForm, setShowPaymentForm] = React.useState(false);
  const [paymentForm, setPaymentForm] = React.useState(EMPTY_PAYMENT_FORM);

  const subscriptionsQuery = useQuery({
    queryKey: ["platform", "subscriptions", workspaceId],
    queryFn: () =>
      billingOperationsService.listSubscriptions({
        workspaceId: workspaceId || undefined,
        limit: 50,
      }),
    enabled: canView && tab === "subscriptions",
  });
  const invoicesQuery = useQuery({
    queryKey: ["platform", "invoices", workspaceId],
    queryFn: () =>
      billingOperationsService.listInvoices({ workspaceId: workspaceId || undefined, limit: 50 }),
    enabled: canView && tab === "invoices",
  });
  const paymentsQuery = useQuery({
    queryKey: ["platform", "payments", workspaceId],
    queryFn: () =>
      billingOperationsService.listPayments({ workspaceId: workspaceId || undefined, limit: 50 }),
    enabled: canView && tab === "payments",
  });

  const invalidate = (key: string) =>
    queryClient.invalidateQueries({ queryKey: ["platform", key] });

  const handleExtendTrial = async () => {
    if (!trialForm || !trialForm.reason.trim()) {
      setError("A reason is required to extend a trial.");
      return;
    }
    setError(null);
    setBusy(trialForm.id);
    try {
      await billingOperationsService.extendTrial(
        trialForm.id,
        trialForm.days,
        trialForm.reason.trim(),
      );
      setTrialForm(null);
      await invalidate("subscriptions");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to extend trial.");
    } finally {
      setBusy(null);
    }
  };

  const handleChangePlan = async () => {
    if (!planForm || !planForm.planId.trim()) return;
    setError(null);
    setBusy(planForm.id);
    try {
      await billingOperationsService.updatePlan(
        planForm.id,
        planForm.planId.trim(),
        planForm.immediate,
      );
      setPlanForm(null);
      await invalidate("subscriptions");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change plan.");
    } finally {
      setBusy(null);
    }
  };

  const handleStatusChange = async (id: string, status: SubscriptionStatus) => {
    setError(null);
    setBusy(id);
    try {
      await billingOperationsService.updateSubscriptionStatus(id, status);
      await invalidate("subscriptions");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update subscription status.");
    } finally {
      setBusy(null);
    }
  };

  const handleVoid = async () => {
    if (!voidForm || !voidForm.reason.trim()) {
      setError("A reason is required to void an invoice.");
      return;
    }
    setError(null);
    setBusy(voidForm.id);
    try {
      await billingOperationsService.voidInvoice(voidForm.id, voidForm.reason.trim());
      setVoidForm(null);
      await invalidate("invoices");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to void invoice.");
    } finally {
      setBusy(null);
    }
  };

  const handleRecordPayment = async () => {
    if (
      !paymentForm.workspaceId.trim() ||
      !paymentForm.invoiceId.trim() ||
      !paymentForm.gateway.trim() ||
      !paymentForm.gatewayReference.trim()
    ) {
      setError("Workspace, invoice, gateway, and reference are all required.");
      return;
    }
    setError(null);
    setBusy("record-payment");
    try {
      await billingOperationsService.recordPayment(paymentForm);
      setPaymentForm(EMPTY_PAYMENT_FORM);
      setShowPaymentForm(false);
      await invalidate("payments");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record payment.");
    } finally {
      setBusy(null);
    }
  };

  const handleRefund = async () => {
    if (!refundForm || !refundForm.reason.trim()) {
      setError("A reason is required to record a refund.");
      return;
    }
    setError(null);
    setBusy(refundForm.id);
    try {
      await billingOperationsService.refundPayment(refundForm.id, refundForm.reason.trim());
      setRefundForm(null);
      await invalidate("payments");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record refund.");
    } finally {
      setBusy(null);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Billing Operations.</Alert>;
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {(["subscriptions", "invoices", "payments"] as const).map((t) => (
            <Button
              key={t}
              type="button"
              variant={tab === t ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTab(t)}
            >
              {t[0]?.toUpperCase()}
              {t.slice(1)}
            </Button>
          ))}
        </div>
        <Input
          aria-label="Filter by workspace ID"
          placeholder="Filter by workspace ID…"
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {tab === "subscriptions" ? (
        subscriptionsQuery.isLoading ? (
          <SkeletonCard />
        ) : (subscriptionsQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No subscriptions"
            description="Subscriptions matching this filter will appear here."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {subscriptionsQuery.data?.items.map((sub) => (
              <Card key={sub.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body-sm font-medium text-neutral-900 dark:text-neutral-50">
                    Workspace {sub.workspaceId}
                  </span>
                  <StageBadge value={sub.status} />
                </div>
                <div className="text-caption flex flex-wrap gap-x-4 gap-y-1 text-neutral-500 dark:text-neutral-400">
                  <span>Plan: {sub.planId}</span>
                  <span>Renews {new Date(sub.renewalDate).toLocaleDateString()}</span>
                  {sub.trialEndsAt ? (
                    <span>Trial ends {new Date(sub.trialEndsAt).toLocaleDateString()}</span>
                  ) : null}
                </div>
                {canManageTrials || canManageSubscriptions ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                    {canManageTrials ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setTrialForm({ id: sub.id, days: 7, reason: "" })}
                      >
                        Extend Trial
                      </Button>
                    ) : null}
                    {canManageSubscriptions ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setPlanForm({ id: sub.id, planId: sub.planId, immediate: true })
                          }
                        >
                          Change Plan
                        </Button>
                        <Select
                          aria-label="Subscription status"
                          className="text-caption h-8 w-40"
                          value={sub.status}
                          disabled={busy === sub.id}
                          onChange={(e) =>
                            void handleStatusChange(sub.id, e.target.value as SubscriptionStatus)
                          }
                        >
                          <option value={SubscriptionStatus.ACTIVE}>ACTIVE</option>
                          <option value={SubscriptionStatus.SUSPENDED}>SUSPENDED</option>
                          <option value={SubscriptionStatus.CANCELLED}>CANCELLED</option>
                        </Select>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {trialForm?.id === sub.id ? (
                  <div className="flex flex-wrap items-end gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                    <Input
                      aria-label="Days"
                      type="number"
                      min={1}
                      max={90}
                      value={trialForm.days}
                      onChange={(e) =>
                        setTrialForm((f) => (f ? { ...f, days: Number(e.target.value) } : f))
                      }
                      className="w-24"
                    />
                    <Input
                      aria-label="Reason"
                      placeholder="Reason"
                      value={trialForm.reason}
                      onChange={(e) =>
                        setTrialForm((f) => (f ? { ...f, reason: e.target.value } : f))
                      }
                      className="max-w-xs"
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={busy === sub.id}
                      onClick={() => void handleExtendTrial()}
                    >
                      Confirm
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setTrialForm(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : null}
                {planForm?.id === sub.id ? (
                  <div className="flex flex-wrap items-end gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                    <Input
                      aria-label="New plan ID"
                      placeholder="Plan ID"
                      value={planForm.planId}
                      onChange={(e) =>
                        setPlanForm((f) => (f ? { ...f, planId: e.target.value } : f))
                      }
                      className="max-w-xs"
                    />
                    <Select
                      aria-label="Timing"
                      value={planForm.immediate ? "immediate" : "queued"}
                      onChange={(e) =>
                        setPlanForm((f) =>
                          f ? { ...f, immediate: e.target.value === "immediate" } : f,
                        )
                      }
                    >
                      <option value="immediate">Immediate</option>
                      <option value="queued">At renewal</option>
                    </Select>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={busy === sub.id}
                      onClick={() => void handleChangePlan()}
                    >
                      Confirm
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPlanForm(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === "invoices" ? (
        invoicesQuery.isLoading ? (
          <SkeletonCard />
        ) : (invoicesQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No invoices"
            description="Invoices matching this filter will appear here."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {invoicesQuery.data?.items.map((invoice) => (
              <div key={invoice.id} className="flex flex-col gap-2">
                <InvoiceCard
                  invoiceNumber={invoice.invoiceNumber}
                  status={invoice.status}
                  amount={invoice.amount}
                  currency={invoice.currency}
                  dueDate={invoice.dueDate}
                  issuedAt={invoice.issuedAt}
                />
                {canManagePayments && invoice.status !== InvoiceStatus.VOID ? (
                  voidForm?.id === invoice.id ? (
                    <div className="flex flex-wrap items-end gap-2 pl-4">
                      <Input
                        aria-label="Void reason"
                        placeholder="Reason"
                        value={voidForm.reason}
                        onChange={(e) =>
                          setVoidForm((f) => (f ? { ...f, reason: e.target.value } : f))
                        }
                        className="max-w-xs"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        loading={busy === invoice.id}
                        onClick={() => void handleVoid()}
                      >
                        Confirm Void
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setVoidForm(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-fit pl-4"
                      onClick={() => setVoidForm({ id: invoice.id, reason: "" })}
                    >
                      Void
                    </Button>
                  )
                ) : null}
              </div>
            ))}
          </div>
        )
      ) : null}

      {tab === "payments" ? (
        <>
          {canManagePayments ? (
            showPaymentForm ? (
              <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Input
                    aria-label="Workspace ID"
                    placeholder="Workspace ID"
                    value={paymentForm.workspaceId}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, workspaceId: e.target.value }))}
                  />
                  <Input
                    aria-label="Invoice ID"
                    placeholder="Invoice ID"
                    value={paymentForm.invoiceId}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, invoiceId: e.target.value }))}
                  />
                  <Input
                    aria-label="Gateway"
                    placeholder="Gateway"
                    value={paymentForm.gateway}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, gateway: e.target.value }))}
                  />
                  <Input
                    aria-label="Gateway reference"
                    placeholder="Gateway reference"
                    value={paymentForm.gatewayReference}
                    onChange={(e) =>
                      setPaymentForm((f) => ({ ...f, gatewayReference: e.target.value }))
                    }
                  />
                  <Input
                    aria-label="Amount"
                    type="number"
                    placeholder="Amount"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm((f) => ({ ...f, amount: Number(e.target.value) }))
                    }
                  />
                  <Input
                    aria-label="Currency"
                    placeholder="Currency"
                    value={paymentForm.currency}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, currency: e.target.value }))}
                  />
                  <Select
                    aria-label="Outcome"
                    value={paymentForm.outcome}
                    onChange={(e) =>
                      setPaymentForm((f) => ({
                        ...f,
                        outcome: e.target.value as "PAID" | "FAILED",
                      }))
                    }
                  >
                    <option value="PAID">PAID</option>
                    <option value="FAILED">FAILED</option>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={busy === "record-payment"}
                    onClick={() => void handleRecordPayment()}
                  >
                    Record payment
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowPaymentForm(false);
                      setPaymentForm(EMPTY_PAYMENT_FORM);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="w-fit"
                onClick={() => setShowPaymentForm(true)}
              >
                Record manual payment
              </Button>
            )
          ) : null}

          {paymentsQuery.isLoading ? (
            <SkeletonCard />
          ) : (paymentsQuery.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title="No payments"
              description="Payments matching this filter will appear here."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {paymentsQuery.data?.items.map((payment) => (
                <div key={payment.id} className="flex flex-col gap-2">
                  <PaymentCard
                    gateway={payment.gateway}
                    gatewayReference={payment.gatewayReference}
                    status={payment.status}
                    amount={payment.amount}
                    currency={payment.currency}
                    paidAt={payment.paidAt}
                  />
                  {canManagePayments && payment.status === PaymentStatus.PAID ? (
                    refundForm?.id === payment.id ? (
                      <div className="flex flex-wrap items-end gap-2 pl-4">
                        <Input
                          aria-label="Refund reason"
                          placeholder="Reason"
                          value={refundForm.reason}
                          onChange={(e) =>
                            setRefundForm((f) => (f ? { ...f, reason: e.target.value } : f))
                          }
                          className="max-w-xs"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          loading={busy === payment.id}
                          onClick={() => void handleRefund()}
                        >
                          Confirm Refund
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setRefundForm(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-fit pl-4"
                        onClick={() => setRefundForm({ id: payment.id, reason: "" })}
                      >
                        Refund
                      </Button>
                    )
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
