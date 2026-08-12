"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission, SubscriptionStatus } from "@wapp/shared-types";
import { Alert, Button, Card, PlanCard, SkeletonCard, StageBadge } from "@wapp/ui";
import { billingService } from "../../services/billing.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";

const FEATURE_LABELS: Record<string, string> = {
  crm: "CRM",
  broadcast: "Broadcast",
  campaigns: "Campaigns",
  automation: "Automation",
  teamMembers: "Team Members",
  reports: "Reports",
  apiAccess: "API Access",
  webhooks: "Webhooks",
  integrations: "Integrations",
};

/**
 * FRD-001 Volume-6 §4.2 — Upgrade and Downgrade are two distinct backend
 * routes with different semantics, not "costlier vs. cheaper" (confirmed
 * against `subscription.service.ts`): Upgrade applies immediately and is
 * used for any immediate plan change; Downgrade is queued, applied only at
 * the next `renewalDate` via `pendingPlanId`. Rather than guessing intent
 * from `monthlyPrice` (which is null for every plan today, TD-009), each
 * non-current plan offers both actions explicitly labeled by timing, not
 * by price direction. Subscription transitions remain entirely
 * backend-owned (BR — Architecture Review, 2026-08-11) — this screen never
 * validates which plan changes are allowed, only calls the route the user
 * picked and surfaces whatever the backend returns or rejects.
 */
export function SubscriptionView(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.BILLING_ACCESS);
  const canEdit = useHasFullPermission(Permission.BILLING_ACCESS);
  const [acting, setActing] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false);

  const subscriptionQuery = useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: () => billingService.subscription(),
    enabled: canView,
  });

  const plansQuery = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: () => billingService.plans(),
    enabled: canView,
  });

  const entitlementsQuery = useQuery({
    queryKey: ["billing", "entitlements"],
    queryFn: () => billingService.entitlements(),
    enabled: canView,
  });

  const invalidateSubscription = () =>
    queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] });

  const handleUpgrade = async (planId: string) => {
    setActionError(null);
    setActing(`upgrade:${planId}`);
    try {
      await billingService.upgradeSubscription(planId);
      await invalidateSubscription();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to upgrade subscription.");
    } finally {
      setActing(null);
    }
  };

  const handleDowngrade = async (planId: string) => {
    setActionError(null);
    setActing(`downgrade:${planId}`);
    try {
      await billingService.downgradeSubscription(planId);
      await invalidateSubscription();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to schedule downgrade.");
    } finally {
      setActing(null);
    }
  };

  const handleCancel = async () => {
    setActionError(null);
    setActing("cancel");
    try {
      await billingService.cancelSubscription();
      await invalidateSubscription();
      setShowCancelConfirm(false);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel subscription.");
    } finally {
      setActing(null);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Billing.</Alert>;
  }

  if (subscriptionQuery.isLoading || plansQuery.isLoading || !subscriptionQuery.data) {
    return <SkeletonCard />;
  }

  const subscription = subscriptionQuery.data;
  const plans = plansQuery.data ?? [];
  const currentPlan = plans.find((p) => p.id === subscription.planId);
  const pendingPlan = plans.find((p) => p.id === subscription.pendingPlanId);
  const isCancelled = subscription.status === SubscriptionStatus.CANCELLED;
  const entitlements = entitlementsQuery.data;

  return (
    <div className="flex flex-col gap-6">
      {actionError ? <Alert variant="danger">{actionError}</Alert> : null}
      {pendingPlan ? (
        <Alert variant="warning">
          A downgrade to {pendingPlan.name} is scheduled for your next renewal (
          {new Date(subscription.renewalDate).toLocaleDateString()}).
        </Alert>
      ) : null}
      {isCancelled ? <Alert variant="info">This subscription has been cancelled.</Alert> : null}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-h3 text-neutral-900 dark:text-neutral-50">
            {currentPlan?.name ?? subscription.planId}
          </span>
          <StageBadge value={subscription.status} />
        </div>
        <div className="text-body-sm grid grid-cols-2 gap-3 text-neutral-600 md:grid-cols-3 dark:text-neutral-400">
          <span>Billing cycle: {subscription.billingCycle}</span>
          <span>Renewal: {new Date(subscription.renewalDate).toLocaleDateString()}</span>
          {subscription.trialEndsAt ? (
            <span>Trial ends: {new Date(subscription.trialEndsAt).toLocaleDateString()}</span>
          ) : null}
        </div>
        {entitlements ? (
          <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
            {Object.entries(entitlements)
              .filter(([, enabled]) => enabled)
              .map(([key]) => (
                <span
                  key={key}
                  className="text-caption rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                >
                  {FEATURE_LABELS[key] ?? key}
                </span>
              ))}
          </div>
        ) : null}
        {canEdit && !isCancelled ? (
          <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
            {showCancelConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-body-sm text-neutral-700 dark:text-neutral-300">
                  Cancel this subscription?
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  loading={acting === "cancel"}
                  onClick={() => void handleCancel()}
                >
                  Confirm Cancel
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCancelConfirm(false)}
                >
                  Back
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCancelConfirm(true)}
              >
                Cancel subscription
              </Button>
            )}
          </div>
        ) : null}
      </Card>

      {canEdit && !isCancelled ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-h3 text-neutral-900 dark:text-neutral-50">Available Plans</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.id === subscription.planId;
              return (
                <div key={plan.id} className="flex flex-col gap-2">
                  <PlanCard
                    name={plan.name}
                    description={plan.description}
                    monthlyPrice={plan.monthlyPrice}
                    yearlyPrice={plan.yearlyPrice}
                    currency={plan.currency}
                    isCurrent={isCurrent}
                  />
                  {!isCurrent ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        loading={acting === `upgrade:${plan.id}`}
                        onClick={() => void handleUpgrade(plan.id)}
                      >
                        Upgrade now
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={acting === `downgrade:${plan.id}`}
                        onClick={() => void handleDowngrade(plan.id)}
                      >
                        Downgrade at renewal
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
