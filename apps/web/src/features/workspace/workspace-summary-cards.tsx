"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { CreditCard, Receipt, Users } from "lucide-react";
import { SkeletonCard, SummaryCard } from "@wapp/ui";
import { billingService } from "../../services/billing.service";
import { crmService } from "../../services/crm.service";
import { useHasPermission } from "../../lib/permissions";

const currency = (value: number): string => `₹${value.toLocaleString("en-IN")}`;

/**
 * FRD-001 Volume-3 §4.8 — Subscription and Billing cards render only for
 * `BILLING_ACCESS` holders (Owner=FULL, Administrator=VIEW_ONLY, everyone
 * else=NONE) — hidden entirely, never a restricted placeholder
 * (Architecture Review, 2026-08-10). Communication Overview is
 * intentionally omitted this volume — no backend dashboard endpoint
 * exists (see docs/TECH-DEBT.md). Each card is a "navigation summary
 * only" (§4.8) — no computation beyond picking which fields to surface.
 * `href`s now link to `/billing` and `/crm` — both routes exist as of
 * FRD-001 Volume-5 (CRM UI) and Volume-6 (Billing UI); this file wasn't
 * revisited when Volume-5 shipped, so that link is wired here too,
 * completing exactly what this comment already said would happen once
 * those volumes landed.
 */
export function WorkspaceSummaryCards(): React.JSX.Element {
  const canViewBilling = useHasPermission(Permission.BILLING_ACCESS);

  const subscriptionQuery = useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: () => billingService.subscription(),
    enabled: canViewBilling,
  });
  const plansQuery = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: () => billingService.plans(),
    enabled: canViewBilling,
  });
  const dashboardQuery = useQuery({
    queryKey: ["billing", "dashboard"],
    queryFn: () => billingService.dashboardReport(),
    enabled: canViewBilling,
  });
  const crmQuery = useQuery({
    queryKey: ["crm", "dashboard"],
    queryFn: () => crmService.dashboardSummary(),
  });

  const planName = plansQuery.data?.find(
    (plan) => plan.id === subscriptionQuery.data?.planId,
  )?.name;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {canViewBilling ? (
        subscriptionQuery.isLoading || plansQuery.isLoading ? (
          <SkeletonCard />
        ) : (
          <SummaryCard
            icon={<CreditCard className="h-4 w-4" aria-hidden />}
            label="Subscription"
            value={planName ?? subscriptionQuery.data?.planId ?? "—"}
            description={
              subscriptionQuery.data
                ? `${subscriptionQuery.data.status} · renews ${new Date(subscriptionQuery.data.renewalDate).toLocaleDateString()}`
                : undefined
            }
            href="/billing/subscription"
          />
        )
      ) : null}

      {canViewBilling ? (
        dashboardQuery.isLoading ? (
          <SkeletonCard />
        ) : (
          <SummaryCard
            icon={<Receipt className="h-4 w-4" aria-hidden />}
            label="Billing"
            value={currency(dashboardQuery.data?.monthlyRevenue ?? 0)}
            description={`${dashboardQuery.data?.pendingInvoices ?? 0} pending invoice(s)`}
            href="/billing"
          />
        )
      ) : null}

      {crmQuery.isLoading ? (
        <SkeletonCard />
      ) : (
        <SummaryCard
          icon={<Users className="h-4 w-4" aria-hidden />}
          label="CRM"
          value={`${crmQuery.data?.totalCustomers ?? 0} customers`}
          description={`${crmQuery.data?.openDeals ?? 0} open deals · ${currency(crmQuery.data?.pipelineValue ?? 0)} pipeline`}
          href="/crm"
        />
      )}
    </div>
  );
}
