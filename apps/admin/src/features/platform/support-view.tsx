"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlatformPermission } from "@wapp/shared-types";
import {
  Alert,
  Button,
  EmptyState,
  Input,
  Select,
  SkeletonCard,
  SupportTicketCard,
} from "@wapp/ui";
import { supportService, type CreateSupportTicketPayload } from "../../services/support.service";
import { useHasFullPlatformPermission, useHasPlatformPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "../../types/platform";

const EMPTY_FORM: CreateSupportTicketPayload = {
  workspaceId: "",
  title: "",
  category: SupportTicketCategory.OTHER,
  priority: SupportTicketPriority.MEDIUM,
};

/**
 * FRD-001 Volume-8 §4.5 — Customer Support. `MANAGE_SUPPORT`. Assign/
 * Change Status/Resolve/Close all go through the same generic `PATCH` —
 * no dedicated routes exist. No Support Dashboard aggregate — this
 * screen composes entirely from `GET /platform/support/tickets`. No
 * workspace name is shown next to a ticket, only its raw `workspaceId`
 * (the ticket itself carries nothing richer — BR-005).
 */
export function SupportView(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPlatformPermission(PlatformPermission.MANAGE_SUPPORT);
  const canEdit = useHasFullPlatformPermission(PlatformPermission.MANAGE_SUPPORT);
  const [workspaceId, setWorkspaceId] = React.useState("");
  const [status, setStatus] = React.useState<SupportTicketStatus | "">("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState<CreateSupportTicketPayload>(EMPTY_FORM);
  const [resolutionDraft, setResolutionDraft] = React.useState<{ id: string; text: string } | null>(
    null,
  );

  const ticketsQuery = useQuery({
    queryKey: ["platform", "support", "tickets", workspaceId, status],
    queryFn: () =>
      supportService.listTickets({
        workspaceId: workspaceId || undefined,
        status: status || undefined,
      }),
    enabled: canView,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["platform", "support", "tickets"] });

  const handleCreate = async () => {
    if (!form.workspaceId.trim() || !form.title.trim()) return;
    setError(null);
    setBusy("create");
    try {
      await supportService.createTicket(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create ticket.");
    } finally {
      setBusy(null);
    }
  };

  const handleStatusChange = async (id: string, next: SupportTicketStatus) => {
    setError(null);
    setBusy(id);
    try {
      await supportService.updateTicket(id, { status: next });
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update ticket status.");
    } finally {
      setBusy(null);
    }
  };

  const handleAssign = async (id: string, operator: string) => {
    if (!operator.trim()) return;
    setError(null);
    setBusy(id);
    try {
      await supportService.updateTicket(id, { assignedOperator: operator.trim() });
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to assign ticket.");
    } finally {
      setBusy(null);
    }
  };

  const handleResolve = async () => {
    if (!resolutionDraft || !resolutionDraft.text.trim()) return;
    setError(null);
    setBusy(resolutionDraft.id);
    try {
      await supportService.updateTicket(resolutionDraft.id, {
        status: SupportTicketStatus.RESOLVED,
        resolution: resolutionDraft.text.trim(),
      });
      setResolutionDraft(null);
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to resolve ticket.");
    } finally {
      setBusy(null);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Customer Support.</Alert>;
  }

  const tickets = ticketsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Filter by workspace ID"
          placeholder="Filter by workspace ID…"
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          className="max-w-xs"
        />
        <Select
          aria-label="Filter by status"
          className="w-48"
          value={status}
          onChange={(e) => setStatus(e.target.value as SupportTicketStatus | "")}
        >
          <option value="">All statuses</option>
          {Object.values(SupportTicketStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {canEdit ? (
        showForm ? (
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                aria-label="Workspace ID"
                placeholder="Workspace ID"
                value={form.workspaceId}
                onChange={(e) => setForm((f) => ({ ...f, workspaceId: e.target.value }))}
              />
              <Input
                aria-label="Title"
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <Select
                aria-label="Category"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value as SupportTicketCategory }))
                }
              >
                {Object.values(SupportTicketCategory).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Priority"
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value as SupportTicketPriority }))
                }
              >
                {Object.values(SupportTicketPriority).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={busy === "create"}
                onClick={() => void handleCreate()}
              >
                Create ticket
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
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
            onClick={() => setShowForm(true)}
          >
            New ticket
          </Button>
        )
      ) : null}

      {ticketsQuery.isLoading ? (
        <SkeletonCard />
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No support tickets"
          description="Tickets matching these filters will appear here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="flex flex-col gap-2">
              <SupportTicketCard
                title={ticket.title}
                workspaceLabel={`Workspace ${ticket.workspaceId}`}
                category={ticket.category}
                priority={ticket.priority}
                status={ticket.status}
                assignedOperator={ticket.assignedOperator}
              />
              {canEdit ? (
                <div className="flex flex-wrap items-center gap-2 pl-4">
                  <Select
                    aria-label="Change status"
                    className="text-caption h-8 w-40"
                    value={ticket.status}
                    disabled={busy === ticket.id}
                    onChange={(e) =>
                      void handleStatusChange(ticket.id, e.target.value as SupportTicketStatus)
                    }
                  >
                    {Object.values(SupportTicketStatus).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                  <Input
                    aria-label="Assign operator"
                    placeholder="Assign to…"
                    className="text-caption h-8 w-40"
                    defaultValue={ticket.assignedOperator ?? ""}
                    onBlur={(e) => void handleAssign(ticket.id, e.target.value)}
                  />
                  {resolutionDraft?.id === ticket.id ? (
                    <>
                      <Input
                        aria-label="Resolution"
                        placeholder="Resolution notes"
                        className="max-w-xs"
                        value={resolutionDraft.text}
                        onChange={(e) =>
                          setResolutionDraft((d) => (d ? { ...d, text: e.target.value } : d))
                        }
                      />
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        loading={busy === ticket.id}
                        onClick={() => void handleResolve()}
                      >
                        Confirm Resolve
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setResolutionDraft(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setResolutionDraft({ id: ticket.id, text: "" })}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
