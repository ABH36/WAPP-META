"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { CustomerStatus, Permission } from "@wapp/shared-types";
import { Plus } from "lucide-react";
import { Alert, Button, CustomerCard, EmptyState, Input, Select, SkeletonCard } from "@wapp/ui";
import { customerService, type CreateCustomerPayload } from "../../services/customer.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";

const STATUS_OPTIONS: Array<{ value: CustomerStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: CustomerStatus.ACTIVE, label: "Active" },
  { value: CustomerStatus.BLOCKED, label: "Blocked" },
  { value: CustomerStatus.ARCHIVED, label: "Archived" },
];

const PAGE_SIZE = 20;
const EMPTY_FORM: CreateCustomerPayload = { customerName: "", mobileNumber: "" };

/** FRD-001 Volume-5 §4.3 — List/Search/Filters/Create. Archive is real and terminal (ADR-CRM-004) — no hard delete route. Create is gated `CREATE_CUSTOMER` at `FULL`. */
export function CustomerList(): React.JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.VIEW_CUSTOMERS);
  const canCreate = useHasFullPermission(Permission.CREATE_CUSTOMER);
  const [status, setStatus] = React.useState<CustomerStatus | "">("");
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState<CreateCustomerPayload>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const customersQuery = useInfiniteQuery({
    queryKey: ["crm", "customers", status],
    queryFn: ({ pageParam }) =>
      customerService.list({ status: status || undefined, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined),
    enabled: canView,
  });

  const handleCreate = async () => {
    if (!form.customerName.trim() || !form.mobileNumber?.trim()) {
      setFormError("Customer name and mobile number are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await customerService.create(form);
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["crm", "customers"] });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create customer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Customers.</Alert>;
  }

  const items = customersQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          aria-label="Filter by status"
          className="w-48"
          value={status}
          onChange={(event) => setStatus(event.target.value as CustomerStatus | "")}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {canCreate ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            New customer
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          {formError ? <Alert variant="danger">{formError}</Alert> : null}
          <Input
            aria-label="Customer name"
            placeholder="Customer name"
            value={form.customerName}
            onChange={(event) => setForm((f) => ({ ...f, customerName: event.target.value }))}
          />
          <Input
            aria-label="Mobile number"
            placeholder="+919876543210"
            value={form.mobileNumber}
            onChange={(event) => setForm((f) => ({ ...f, mobileNumber: event.target.value }))}
          />
          <Input
            aria-label="Company name"
            placeholder="Company name (optional)"
            value={form.companyName ?? ""}
            onChange={(event) => setForm((f) => ({ ...f, companyName: event.target.value }))}
          />
          <Input
            aria-label="Email"
            placeholder="Email (optional)"
            value={form.email ?? ""}
            onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
          />
          <Button
            type="button"
            variant="primary"
            loading={submitting}
            className="w-fit"
            onClick={() => void handleCreate()}
          >
            Create customer
          </Button>
        </div>
      ) : null}

      {customersQuery.isLoading ? (
        <SkeletonCard />
      ) : items.length === 0 ? (
        <EmptyState
          title="No customers"
          description="Customers matching these filters will appear here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((customer) => (
            <CustomerCard
              key={customer.id}
              customerName={customer.customerName}
              companyName={customer.companyName}
              status={customer.status}
              mobileNumber={customer.mobileNumber}
              onClick={() => router.push(`/crm/customers/${customer.id}`)}
            />
          ))}
        </div>
      )}

      {customersQuery.hasNextPage ? (
        <Button
          variant="secondary"
          size="sm"
          className="w-fit"
          loading={customersQuery.isFetchingNextPage}
          onClick={() => void customersQuery.fetchNextPage()}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}
