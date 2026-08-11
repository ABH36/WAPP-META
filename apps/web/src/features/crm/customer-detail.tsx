"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CustomerStatus, Permission } from "@wapp/shared-types";
import { Alert, Badge, Button, Card, DealCard, Input, SkeletonText } from "@wapp/ui";
import { customerService, type UpdateCustomerPayload } from "../../services/customer.service";
import { dealService } from "../../services/deal.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import { ActivityFeed } from "./activity-feed";

interface CustomerDetailProps {
  customerId: string;
}

/** FRD-001 Volume-5 §4.3 — no `assignedUserId` field exists on Customer (Architecture Review, 2026-08-11), so no "Assigned User" row is shown. Related Deals/Activities are composed via separate calls — `CustomerSummary` never returns them inline. */
export function CustomerDetail({ customerId }: CustomerDetailProps): React.JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.VIEW_CUSTOMERS);
  const canEdit = useHasFullPermission(Permission.EDIT_CUSTOMER);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState(false);
  const [form, setForm] = React.useState<UpdateCustomerPayload | null>(null);

  const customerQuery = useQuery({
    queryKey: ["crm", "customer", customerId],
    queryFn: () => customerService.getById(customerId),
    enabled: canView,
  });

  const dealsQuery = useQuery({
    queryKey: ["crm", "customer", customerId, "deals"],
    queryFn: () => dealService.list({ customerId, page: 1, limit: 10 }),
    enabled: canView,
  });

  React.useEffect(() => {
    if (!customerQuery.data) return;
    setForm({
      customerName: customerQuery.data.customerName,
      companyName: customerQuery.data.companyName ?? "",
      email: customerQuery.data.email ?? "",
      gstNumber: customerQuery.data.gstNumber ?? "",
      address: customerQuery.data.address ?? "",
      city: customerQuery.data.city ?? "",
      state: customerQuery.data.state ?? "",
      country: customerQuery.data.country ?? "",
      postalCode: customerQuery.data.postalCode ?? "",
      website: customerQuery.data.website ?? "",
      industry: customerQuery.data.industry ?? "",
      notes: customerQuery.data.notes ?? "",
    });
  }, [customerQuery.data]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["crm", "customer", customerId] });

  const handleSave = async () => {
    if (!form) return;
    setActionError(null);
    setActing(true);
    try {
      const updated = await customerService.update(customerId, form);
      queryClient.setQueryData(["crm", "customer", customerId], updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save changes.");
    } finally {
      setActing(false);
    }
  };

  const runStatusAction = async (action: () => Promise<unknown>) => {
    setActionError(null);
    setActing(true);
    try {
      await action();
      await invalidate();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setActing(false);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Customers.</Alert>;
  }

  if (customerQuery.isLoading || !form) {
    return <SkeletonText lines={8} />;
  }

  const customer = customerQuery.data;
  if (!customer) {
    return <Alert variant="danger">Unable to load this customer.</Alert>;
  }

  return (
    <div className="flex flex-col gap-4">
      {actionError ? <Alert variant="danger">{actionError}</Alert> : null}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Input
            aria-label="Customer name"
            disabled={!canEdit || customer.status === CustomerStatus.ARCHIVED}
            value={form.customerName ?? ""}
            onChange={(event) => setForm((f) => ({ ...f, customerName: event.target.value }))}
            className="text-h3 max-w-sm"
          />
          <Badge variant="neutral">{customer.status}</Badge>
        </div>
        <Input
          aria-label="Company name"
          placeholder="Company name"
          disabled={!canEdit || customer.status === CustomerStatus.ARCHIVED}
          value={form.companyName ?? ""}
          onChange={(event) => setForm((f) => ({ ...f, companyName: event.target.value }))}
        />
        <Input
          aria-label="Email"
          placeholder="Email"
          disabled={!canEdit || customer.status === CustomerStatus.ARCHIVED}
          value={form.email ?? ""}
          onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
        />
        <Input
          aria-label="GSTIN"
          placeholder="GSTIN"
          disabled={!canEdit || customer.status === CustomerStatus.ARCHIVED}
          value={form.gstNumber ?? ""}
          onChange={(event) => setForm((f) => ({ ...f, gstNumber: event.target.value }))}
        />
        <Input
          aria-label="Address"
          placeholder="Address"
          disabled={!canEdit || customer.status === CustomerStatus.ARCHIVED}
          value={form.address ?? ""}
          onChange={(event) => setForm((f) => ({ ...f, address: event.target.value }))}
        />

        {canEdit && customer.status !== CustomerStatus.ARCHIVED ? (
          <Button
            type="button"
            variant="primary"
            loading={acting}
            className="w-fit"
            onClick={() => void handleSave()}
          >
            Save changes
          </Button>
        ) : null}

        {canEdit ? (
          <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
            {customer.status === CustomerStatus.ACTIVE ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={acting}
                onClick={() => void runStatusAction(() => customerService.block(customerId))}
              >
                Block
              </Button>
            ) : null}
            {customer.status === CustomerStatus.BLOCKED ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={acting}
                onClick={() => void runStatusAction(() => customerService.activate(customerId))}
              >
                Reactivate
              </Button>
            ) : null}
            {customer.status !== CustomerStatus.ARCHIVED ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                loading={acting}
                onClick={() => void runStatusAction(() => customerService.archive(customerId))}
              >
                Archive
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div>
        <h3 className="text-h3 mb-2 text-neutral-900 dark:text-neutral-50">Related deals</h3>
        {dealsQuery.isLoading ? (
          <SkeletonText lines={2} />
        ) : (dealsQuery.data?.items ?? []).length === 0 ? (
          <p className="text-body-sm text-neutral-500 dark:text-neutral-400">No deals yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(dealsQuery.data?.items ?? []).map((deal) => (
              <DealCard
                key={deal.id}
                title={deal.title}
                stage={deal.stage}
                value={deal.value}
                currency={deal.currency}
                probability={deal.probability}
                expectedCloseDate={deal.expectedCloseDate}
                onClick={() => router.push(`/crm/deals/${deal.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <ActivityFeed customerId={customerId} />
    </div>
  );
}
