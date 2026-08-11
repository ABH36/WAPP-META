"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LeadStatus, Permission } from "@wapp/shared-types";
import { Alert, Badge, Button, Card, Input, Select, SkeletonText, Textarea } from "@wapp/ui";
import { leadService, type UpdateLeadPayload } from "../../services/lead.service";
import { teamService } from "../../services/team.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { getValidLeadTransitions } from "../../lib/crm-transitions";
import { ApiError } from "../../lib/api";

interface LeadDetailProps {
  leadId: string;
}

/**
 * FRD-001 Volume-5 §4.2 — a converted Lead (`convertedAt` set) is
 * permanently read-only: edit/assign/status/archive all reject once
 * converted (Architecture Review, 2026-08-11) — the detail view disables
 * every control rather than letting the user hit a 400. Convert itself
 * has no confirmation dialog primitive available (Modal is still
 * deferred per DS-001's incremental-addition convention), so it's gated
 * behind a plain "Convert to Customer" button with an inline warning
 * instead — irreversible, but not hidden behind extra UI machinery this
 * volume doesn't have.
 */
export function LeadDetail({ leadId }: LeadDetailProps): React.JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.VIEW_LEADS);
  const canEdit = useHasFullPermission(Permission.UPDATE_LEAD_STAGE);
  const canConvert = useHasFullPermission(Permission.CONVERT_LEADS);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState(false);
  const [form, setForm] = React.useState<UpdateLeadPayload | null>(null);

  const leadQuery = useQuery({
    queryKey: ["crm", "lead", leadId],
    queryFn: () => leadService.getById(leadId),
    enabled: canView,
  });

  const membersQuery = useQuery({
    queryKey: ["team", "members"],
    queryFn: () => teamService.listMembers(),
    enabled: canEdit,
  });

  React.useEffect(() => {
    if (!leadQuery.data) return;
    setForm({
      leadName: leadQuery.data.leadName,
      company: leadQuery.data.company ?? "",
      email: leadQuery.data.email ?? "",
      industry: leadQuery.data.industry ?? "",
      expectedValue: leadQuery.data.expectedValue ?? undefined,
      notes: leadQuery.data.notes ?? "",
    });
  }, [leadQuery.data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["crm", "lead", leadId] });

  const locked = !!leadQuery.data?.convertedAt;

  const handleSave = async () => {
    if (!form) return;
    setActionError(null);
    setActing(true);
    try {
      const updated = await leadService.update(leadId, form);
      queryClient.setQueryData(["crm", "lead", leadId], updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save changes.");
    } finally {
      setActing(false);
    }
  };

  const handleAssign = async (assignedUserId: string) => {
    setActionError(null);
    setActing(true);
    try {
      const updated = await leadService.assign(leadId, assignedUserId || null);
      queryClient.setQueryData(["crm", "lead", leadId], updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to assign lead.");
    } finally {
      setActing(false);
    }
  };

  const handleStatusChange = async (status: LeadStatus) => {
    setActionError(null);
    setActing(true);
    try {
      const updated = await leadService.updateStatus(leadId, status);
      queryClient.setQueryData(["crm", "lead", leadId], updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update status.");
    } finally {
      setActing(false);
    }
  };

  const handleArchive = async () => {
    setActionError(null);
    setActing(true);
    try {
      await leadService.archive(leadId);
      await invalidate();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to archive lead.");
    } finally {
      setActing(false);
    }
  };

  const handleConvert = async () => {
    setActionError(null);
    setActing(true);
    try {
      const result = await leadService.convert(leadId);
      await invalidate();
      router.push(`/crm/customers/${result.customerId}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to convert lead.");
    } finally {
      setActing(false);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Leads.</Alert>;
  }

  if (leadQuery.isLoading || !form) {
    return <SkeletonText lines={8} />;
  }

  const lead = leadQuery.data;
  if (!lead) {
    return <Alert variant="danger">Unable to load this lead.</Alert>;
  }

  const validNextStatuses = getValidLeadTransitions(lead.status);

  return (
    <div className="flex flex-col gap-4">
      {actionError ? <Alert variant="danger">{actionError}</Alert> : null}
      {locked ? (
        <Alert variant="info">
          This lead was converted to a Customer and is now read-only.{" "}
          {lead.customerId ? (
            <Link
              href={`/crm/customers/${lead.customerId}`}
              className="text-brand-700 dark:text-brand-300 font-medium underline"
            >
              View Customer
            </Link>
          ) : null}
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Input
            aria-label="Lead name"
            disabled={!canEdit || locked}
            value={form.leadName ?? ""}
            onChange={(event) => setForm((f) => ({ ...f, leadName: event.target.value }))}
            className="text-h3 max-w-sm"
          />
          <Badge variant="neutral">{lead.status}</Badge>
        </div>

        <Input
          aria-label="Company"
          placeholder="Company"
          disabled={!canEdit || locked}
          value={form.company ?? ""}
          onChange={(event) => setForm((f) => ({ ...f, company: event.target.value }))}
        />
        <Input
          aria-label="Email"
          placeholder="Email"
          disabled={!canEdit || locked}
          value={form.email ?? ""}
          onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
        />
        <Input
          aria-label="Industry"
          placeholder="Industry"
          disabled={!canEdit || locked}
          value={form.industry ?? ""}
          onChange={(event) => setForm((f) => ({ ...f, industry: event.target.value }))}
        />
        <Input
          aria-label="Expected value"
          type="number"
          placeholder="Expected value"
          disabled={!canEdit || locked}
          value={form.expectedValue ?? ""}
          onChange={(event) =>
            setForm((f) => ({ ...f, expectedValue: Number(event.target.value) }))
          }
        />
        <Textarea
          aria-label="Notes"
          placeholder="Notes"
          disabled={!canEdit || locked}
          value={form.notes ?? ""}
          onChange={(event) => setForm((f) => ({ ...f, notes: event.target.value }))}
        />

        {canEdit && !locked ? (
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
      </Card>

      {canEdit ? (
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="max-w-xs flex-1">
              <label
                htmlFor="lead-status"
                className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
              >
                Status
              </label>
              <Select
                id="lead-status"
                disabled={locked || validNextStatuses.length === 0}
                value={lead.status}
                onChange={(event) => void handleStatusChange(event.target.value as LeadStatus)}
              >
                <option value={lead.status}>{lead.status}</option>
                {validNextStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </div>
            <div className="max-w-xs flex-1">
              <label
                htmlFor="lead-assign"
                className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
              >
                Assigned to
              </label>
              <Select
                id="lead-assign"
                disabled={locked}
                value={lead.assignedUserId ?? ""}
                onChange={(event) => void handleAssign(event.target.value)}
              >
                <option value="">Unassigned</option>
                {(membersQuery.data ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
            {!locked && !lead.archivedAt ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={acting}
                onClick={() => void handleArchive()}
              >
                Archive (Delete)
              </Button>
            ) : null}
            {canConvert && !locked && lead.status === LeadStatus.WON ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={acting}
                onClick={() => void handleConvert()}
              >
                Convert to Customer
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
