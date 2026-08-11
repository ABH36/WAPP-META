"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DealLostReason, DealStage, Permission } from "@wapp/shared-types";
import { Alert, Badge, Button, Card, Input, ProbabilityBadge, Select } from "@wapp/ui";
import { dealService, type UpdateDealPayload } from "../../services/deal.service";
import { teamService } from "../../services/team.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { getValidDealTransitions } from "../../lib/crm-transitions";
import { ApiError } from "../../lib/api";
import { ActivityFeed } from "./activity-feed";

const LOST_REASONS: DealLostReason[] = [
  DealLostReason.PRICE,
  DealLostReason.COMPETITOR,
  DealLostReason.NO_RESPONSE,
  DealLostReason.BUDGET,
  DealLostReason.REQUIREMENT_CHANGED,
  DealLostReason.OTHER,
];

interface DealDetailProps {
  dealId: string;
}

/**
 * FRD-001 Volume-5 §4.4/§4.5 — a Deal's identity (`contactId`/`customerId`/
 * `sourceLeadId`) is permanently immutable, but business fields
 * (value/title/description/probability/expectedCloseDate) stay editable
 * even after WON/LOST — "correcting a closed Deal's value is ordinary CRM
 * behaviour" (ADR-CRM-014). "Close Won"/"Close Lost" both go through the
 * same `/stage` route the regular stage picker uses — `lostReason` is
 * required by the backend only when the target stage is `LOST`.
 */
export function DealDetail({ dealId }: DealDetailProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.VIEW_DEALS);
  const canEdit = useHasFullPermission(Permission.CREATE_DEALS);
  const canClose = useHasFullPermission(Permission.CLOSE_DEALS);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState(false);
  const [form, setForm] = React.useState<UpdateDealPayload | null>(null);
  const [pendingLostReason, setPendingLostReason] = React.useState<DealLostReason | "">("");
  const [showLostReasonPicker, setShowLostReasonPicker] = React.useState(false);

  const dealQuery = useQuery({
    queryKey: ["crm", "deal", dealId],
    queryFn: () => dealService.getById(dealId),
    enabled: canView,
  });

  const membersQuery = useQuery({
    queryKey: ["team", "members"],
    queryFn: () => teamService.listMembers(),
    enabled: canEdit,
  });

  React.useEffect(() => {
    if (!dealQuery.data) return;
    setForm({
      title: dealQuery.data.title,
      description: dealQuery.data.description ?? "",
      value: dealQuery.data.value,
      currency: dealQuery.data.currency,
      probability: dealQuery.data.probability,
      expectedCloseDate: dealQuery.data.expectedCloseDate ?? undefined,
    });
  }, [dealQuery.data]);

  const handleSave = async () => {
    if (!form) return;
    setActionError(null);
    setActing(true);
    try {
      const updated = await dealService.update(dealId, form);
      queryClient.setQueryData(["crm", "deal", dealId], updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save changes.");
    } finally {
      setActing(false);
    }
  };

  const handleAssign = async (assignedTo: string) => {
    setActionError(null);
    setActing(true);
    try {
      const updated = await dealService.assign(dealId, assignedTo || null);
      queryClient.setQueryData(["crm", "deal", dealId], updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to assign deal.");
    } finally {
      setActing(false);
    }
  };

  const handleStageChange = async (stage: DealStage) => {
    if (stage === DealStage.LOST) {
      setShowLostReasonPicker(true);
      return;
    }
    setActionError(null);
    setActing(true);
    try {
      const updated = await dealService.updateStage(dealId, stage);
      queryClient.setQueryData(["crm", "deal", dealId], updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update stage.");
    } finally {
      setActing(false);
    }
  };

  const confirmLost = async () => {
    if (!pendingLostReason) {
      setActionError("A reason is required to mark a deal as Lost.");
      return;
    }
    setActionError(null);
    setActing(true);
    try {
      const updated = await dealService.updateStage(dealId, DealStage.LOST, pendingLostReason);
      queryClient.setQueryData(["crm", "deal", dealId], updated);
      setShowLostReasonPicker(false);
      setPendingLostReason("");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to mark deal as lost.");
    } finally {
      setActing(false);
    }
  };

  const handleReopen = async () => {
    setActionError(null);
    setActing(true);
    try {
      const updated = await dealService.reopen(dealId);
      queryClient.setQueryData(["crm", "deal", dealId], updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to reopen deal.");
    } finally {
      setActing(false);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Deals.</Alert>;
  }

  if (dealQuery.isLoading || !form) {
    return <Alert variant="info">Loading…</Alert>;
  }

  const deal = dealQuery.data;
  if (!deal) {
    return <Alert variant="danger">Unable to load this deal.</Alert>;
  }

  const validNextStages = getValidDealTransitions(deal.stage);

  return (
    <div className="flex flex-col gap-4">
      {actionError ? <Alert variant="danger">{actionError}</Alert> : null}
      {deal.lostReason ? <Alert variant="warning">Lost reason: {deal.lostReason}</Alert> : null}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Input
            aria-label="Deal title"
            disabled={!canEdit}
            value={form.title ?? ""}
            onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
            className="text-h3 max-w-sm"
          />
          <div className="flex items-center gap-2">
            <Badge variant="neutral">{deal.stage}</Badge>
            <ProbabilityBadge probability={form.probability ?? deal.probability} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input
            aria-label="Value"
            type="number"
            disabled={!canEdit}
            value={form.value ?? ""}
            onChange={(event) => setForm((f) => ({ ...f, value: Number(event.target.value) }))}
            className="max-w-xs"
          />
          <Input
            aria-label="Currency"
            disabled={!canEdit}
            value={form.currency ?? ""}
            onChange={(event) => setForm((f) => ({ ...f, currency: event.target.value }))}
            className="w-20"
          />
          <Input
            aria-label="Probability"
            type="number"
            min={0}
            max={100}
            disabled={!canEdit}
            value={form.probability ?? ""}
            onChange={(event) =>
              setForm((f) => ({ ...f, probability: Number(event.target.value) }))
            }
            className="max-w-xs"
          />
        </div>
        <Input
          aria-label="Expected close date"
          type="date"
          disabled={!canEdit}
          value={form.expectedCloseDate ?? ""}
          onChange={(event) => setForm((f) => ({ ...f, expectedCloseDate: event.target.value }))}
          className="max-w-xs"
        />

        {canEdit ? (
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
            {canClose ? (
              <div className="max-w-xs flex-1">
                <label
                  htmlFor="deal-stage"
                  className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Stage
                </label>
                <Select
                  id="deal-stage"
                  disabled={validNextStages.length === 0}
                  value={deal.stage}
                  onChange={(event) => void handleStageChange(event.target.value as DealStage)}
                >
                  <option value={deal.stage}>{deal.stage}</option>
                  {validNextStages.map((stg) => (
                    <option key={stg} value={stg}>
                      {stg}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div className="max-w-xs flex-1">
              <label
                htmlFor="deal-assign"
                className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
              >
                Assigned to
              </label>
              <Select
                id="deal-assign"
                value={deal.assignedTo ?? ""}
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

          {showLostReasonPicker ? (
            <div className="flex flex-wrap items-end gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
              <div className="max-w-xs flex-1">
                <label
                  htmlFor="lost-reason"
                  className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Reason (required)
                </label>
                <Select
                  id="lost-reason"
                  value={pendingLostReason}
                  onChange={(event) => setPendingLostReason(event.target.value as DealLostReason)}
                >
                  <option value="">Choose a reason…</option>
                  {LOST_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                loading={acting}
                onClick={() => void confirmLost()}
              >
                Confirm Lost
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowLostReasonPicker(false)}
              >
                Cancel
              </Button>
            </div>
          ) : null}

          {canClose && deal.stage === DealStage.LOST ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit"
              loading={acting}
              onClick={() => void handleReopen()}
            >
              Reopen
            </Button>
          ) : null}
        </Card>
      ) : null}

      <ActivityFeed dealId={dealId} />
    </div>
  );
}
