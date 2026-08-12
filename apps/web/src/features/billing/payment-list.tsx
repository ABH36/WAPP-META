"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, EmptyState, PaymentCard, SkeletonCard } from "@wapp/ui";
import { billingService } from "../../services/billing.service";
import { useHasPermission } from "../../lib/permissions";

/**
 * FRD-001 Volume-6 §4.5/§5 — View only, no detail route named in the
 * approved routing list (`/billing/payments` only, no `:id` sub-route) —
 * `PaymentCard` renders non-interactively. Manual payment
 * recording/refunds remain Platform Administration responsibility per the
 * Architect's approval — even though `POST /billing/payments`/`refunds`
 * technically exist and are Owner-reachable server-side, this is a known
 * interim gap (TD-010), not a capability this UI exposes.
 */
export function PaymentList(): React.JSX.Element {
  const canView = useHasPermission(Permission.BILLING_ACCESS);

  const paymentsQuery = useQuery({
    queryKey: ["billing", "payments"],
    queryFn: () => billingService.payments(),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Billing.</Alert>;
  }

  if (paymentsQuery.isLoading) {
    return <SkeletonCard />;
  }

  const payments = paymentsQuery.data ?? [];

  if (payments.length === 0) {
    return (
      <EmptyState title="No payments" description="Payments will appear here once recorded." />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {payments.map((payment) => (
        <PaymentCard
          key={payment.id}
          gateway={payment.gateway}
          gatewayReference={payment.gatewayReference}
          status={payment.status}
          amount={payment.amount}
          currency={payment.currency}
          paidAt={payment.paidAt}
        />
      ))}
    </div>
  );
}
