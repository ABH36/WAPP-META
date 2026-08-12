"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, Card, SkeletonText, StageBadge } from "@wapp/ui";
import { billingService } from "../../services/billing.service";
import { useHasPermission } from "../../lib/permissions";

interface InvoiceDetailProps {
  invoiceId: string;
}

/** FRD-001 Volume-6 §4.4 — read-only detail. No Download action — no PDF/download endpoint exists anywhere in the backend (dropped this volume, Tech Debt filed). */
export function InvoiceDetail({ invoiceId }: InvoiceDetailProps): React.JSX.Element {
  const canView = useHasPermission(Permission.BILLING_ACCESS);

  const invoiceQuery = useQuery({
    queryKey: ["billing", "invoice", invoiceId],
    queryFn: () => billingService.invoice(invoiceId),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Billing.</Alert>;
  }

  if (invoiceQuery.isLoading || !invoiceQuery.data) {
    return <SkeletonText lines={5} />;
  }

  const invoice = invoiceQuery.data;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-h3 text-neutral-900 dark:text-neutral-50">
          {invoice.invoiceNumber}
        </span>
        <StageBadge value={invoice.status} />
      </div>
      <div className="text-body-sm grid grid-cols-2 gap-3 text-neutral-600 md:grid-cols-3 dark:text-neutral-400">
        <span>
          Amount:{" "}
          {invoice.amount !== null
            ? `${invoice.currency} ${invoice.amount.toLocaleString()}`
            : "Pricing pending"}
        </span>
        <span>
          Tax:{" "}
          {invoice.tax !== null
            ? `${invoice.currency} ${invoice.tax.toLocaleString()}`
            : "Pricing pending"}
        </span>
        <span>Issued: {new Date(invoice.issuedAt).toLocaleDateString()}</span>
        <span>Due: {new Date(invoice.dueDate).toLocaleDateString()}</span>
        <span>
          Paid: {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : "Not yet paid"}
        </span>
      </div>
    </Card>
  );
}
