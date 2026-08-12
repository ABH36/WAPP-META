"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, EmptyState, InvoiceCard, SkeletonCard } from "@wapp/ui";
import { billingService } from "../../services/billing.service";
import { useHasPermission } from "../../lib/permissions";

/**
 * FRD-001 Volume-6 §4.4 — List + Detail View only. No Create (Invoice
 * generation is internal-only, never user-triggered — `InvoiceController`
 * has no `POST` route at all) and no Download (no PDF/download endpoint
 * exists anywhere in the backend, tenant or platform side — dropped this
 * volume, filed as Tech Debt per Architecture Review, 2026-08-11).
 * `GET /billing/invoices` returns a plain array, not a paginated envelope
 * — no "Load more" needed.
 */
export function InvoiceList(): React.JSX.Element {
  const router = useRouter();
  const canView = useHasPermission(Permission.BILLING_ACCESS);

  const invoicesQuery = useQuery({
    queryKey: ["billing", "invoices"],
    queryFn: () => billingService.invoices(),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Billing.</Alert>;
  }

  if (invoicesQuery.isLoading) {
    return <SkeletonCard />;
  }

  const invoices = invoicesQuery.data ?? [];

  if (invoices.length === 0) {
    return (
      <EmptyState title="No invoices" description="Invoices will appear here once generated." />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {invoices.map((invoice) => (
        <InvoiceCard
          key={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
          status={invoice.status}
          amount={invoice.amount}
          currency={invoice.currency}
          dueDate={invoice.dueDate}
          issuedAt={invoice.issuedAt}
          onClick={() => router.push(`/billing/invoices/${invoice.id}`)}
        />
      ))}
    </div>
  );
}
