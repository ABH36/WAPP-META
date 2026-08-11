"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { LeadSource, LeadStatus, Permission } from "@wapp/shared-types";
import { Plus } from "lucide-react";
import { Alert, Button, EmptyState, Input, LeadCard, Select, SkeletonCard } from "@wapp/ui";
import { leadService, type CreateLeadPayload } from "../../services/lead.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";

const STATUS_OPTIONS: Array<{ value: LeadStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: LeadStatus.NEW, label: "New" },
  { value: LeadStatus.CONTACTED, label: "Contacted" },
  { value: LeadStatus.QUALIFIED, label: "Qualified" },
  { value: LeadStatus.PROPOSAL_SENT, label: "Proposal sent" },
  { value: LeadStatus.NEGOTIATION, label: "Negotiation" },
  { value: LeadStatus.WON, label: "Won" },
  { value: LeadStatus.LOST, label: "Lost" },
  { value: LeadStatus.UNQUALIFIED, label: "Unqualified" },
];

const SOURCE_OPTIONS: LeadSource[] = [
  LeadSource.WHATSAPP,
  LeadSource.MANUAL_ENTRY,
  LeadSource.WEBSITE,
  LeadSource.REFERRAL,
  LeadSource.EXISTING_CUSTOMER,
];

const PAGE_SIZE = 20;
const EMPTY_FORM: CreateLeadPayload = {
  leadName: "",
  mobileNumber: "",
  source: LeadSource.MANUAL_ENTRY,
};

/** FRD-001 Volume-5 §4.2 — List/Search/Filters/Create. "Delete" is Archive (no hard delete route exists). Create is gated `CREATE_LEADS` at `FULL`. */
export function LeadList(): React.JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.VIEW_LEADS);
  const canCreate = useHasFullPermission(Permission.CREATE_LEADS);
  const [status, setStatus] = React.useState<LeadStatus | "">("");
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState<CreateLeadPayload>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const leadsQuery = useInfiniteQuery({
    queryKey: ["crm", "leads", status],
    queryFn: ({ pageParam }) =>
      leadService.list({ status: status || undefined, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined),
    enabled: canView,
  });

  const handleCreate = async () => {
    if (!form.leadName.trim() || !form.mobileNumber?.trim()) {
      setFormError("Lead name and mobile number are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await leadService.create(form);
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["crm", "leads"] });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create lead.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Leads.</Alert>;
  }

  const items = leadsQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          aria-label="Filter by status"
          className="w-48"
          value={status}
          onChange={(event) => setStatus(event.target.value as LeadStatus | "")}
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
            New lead
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          {formError ? <Alert variant="danger">{formError}</Alert> : null}
          <Input
            aria-label="Lead name"
            placeholder="Lead name"
            value={form.leadName}
            onChange={(event) => setForm((f) => ({ ...f, leadName: event.target.value }))}
          />
          <Input
            aria-label="Mobile number"
            placeholder="+919876543210"
            value={form.mobileNumber}
            onChange={(event) => setForm((f) => ({ ...f, mobileNumber: event.target.value }))}
          />
          <Select
            aria-label="Source"
            value={form.source}
            onChange={(event) =>
              setForm((f) => ({ ...f, source: event.target.value as LeadSource }))
            }
          >
            {SOURCE_OPTIONS.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Company"
            placeholder="Company (optional)"
            value={form.company ?? ""}
            onChange={(event) => setForm((f) => ({ ...f, company: event.target.value }))}
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
            Create lead
          </Button>
        </div>
      ) : null}

      {leadsQuery.isLoading ? (
        <SkeletonCard />
      ) : items.length === 0 ? (
        <EmptyState title="No leads" description="Leads matching these filters will appear here." />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((lead) => (
            <LeadCard
              key={lead.id}
              leadName={lead.leadName}
              status={lead.status}
              source={lead.source}
              createdAt={lead.createdAt}
              converted={!!lead.convertedAt}
              onClick={() => router.push(`/crm/leads/${lead.id}`)}
            />
          ))}
        </div>
      )}

      {leadsQuery.hasNextPage ? (
        <Button
          variant="secondary"
          size="sm"
          className="w-fit"
          loading={leadsQuery.isFetchingNextPage}
          onClick={() => void leadsQuery.fetchNextPage()}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}
