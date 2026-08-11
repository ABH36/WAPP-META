"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DealLostReason, DealStage, Permission } from "@wapp/shared-types";
import { Alert, Button, DealTile, PipelineColumn, Select, SkeletonCard } from "@wapp/ui";
import { dealService } from "../../services/deal.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { getValidDealTransitions } from "../../lib/crm-transitions";
import { ApiError } from "../../lib/api";
import type { DealSummary } from "../../types/deal";

const COLUMNS: DealStage[] = [
  DealStage.OPEN,
  DealStage.QUALIFICATION,
  DealStage.PROPOSAL,
  DealStage.NEGOTIATION,
  DealStage.WON,
  DealStage.LOST,
];

const LOST_REASONS: DealLostReason[] = [
  DealLostReason.PRICE,
  DealLostReason.COMPETITOR,
  DealLostReason.NO_RESPONSE,
  DealLostReason.BUDGET,
  DealLostReason.REQUIREMENT_CHANGED,
  DealLostReason.OTHER,
];

/**
 * FRD-001 Volume-5 §4.5 — Kanban board built from the ordinary Deals list
 * (no dedicated pipeline endpoint exists). `OPEN` is included as the
 * first column — every Deal starts here and the backend never
 * auto-transitions it (Architecture Review, 2026-08-11, correcting the
 * original 5-column FRD spec). Drag-and-drop only allows dropping into a
 * column that's a real next stage per `getValidDealTransitions` — the
 * backend remains the actual enforcer (BR-007) via the same
 * `PATCH /crm/deals/:id/stage` route the Deal detail page uses. Dropping
 * onto Lost prompts for the required `lostReason` before calling the API,
 * matching Deal Detail's own flow.
 */
export function PipelineBoard(): React.JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.VIEW_DEALS);
  const canEdit = useHasFullPermission(Permission.CREATE_DEALS);
  const canClose = useHasFullPermission(Permission.CLOSE_DEALS);
  const [draggedDeal, setDraggedDeal] = React.useState<DealSummary | null>(null);
  const [dragOverColumn, setDragOverColumn] = React.useState<DealStage | null>(null);
  const [pendingLostMove, setPendingLostMove] = React.useState<DealSummary | null>(null);
  const [lostReason, setLostReason] = React.useState<DealLostReason | "">("");
  const [error, setError] = React.useState<string | null>(null);

  const dealsQuery = useQuery({
    queryKey: ["crm", "deals", "pipeline"],
    queryFn: () => dealService.list({ page: 1, limit: 200 }),
    enabled: canView,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["crm", "deals", "pipeline"] });

  const moveDeal = async (deal: DealSummary, targetStage: DealStage, reason?: DealLostReason) => {
    setError(null);
    try {
      await dealService.updateStage(deal.id, targetStage, reason);
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to move deal.");
    }
  };

  const handleDrop = (targetStage: DealStage) => {
    setDragOverColumn(null);
    if (!draggedDeal || !canEdit) return;
    const deal = draggedDeal;
    setDraggedDeal(null);
    if (deal.stage === targetStage) return;
    const validTargets = getValidDealTransitions(deal.stage);
    if (!validTargets.includes(targetStage)) {
      setError(`Cannot move a deal directly from ${deal.stage} to ${targetStage}.`);
      return;
    }
    if (targetStage === DealStage.LOST) {
      if (!canClose) {
        setError("You don't have permission to mark a deal as Lost.");
        return;
      }
      setPendingLostMove(deal);
      return;
    }
    if (targetStage === DealStage.WON && !canClose) {
      setError("You don't have permission to mark a deal as Won.");
      return;
    }
    void moveDeal(deal, targetStage);
  };

  const confirmLostMove = async () => {
    if (!pendingLostMove || !lostReason) {
      setError("A reason is required to mark a deal as Lost.");
      return;
    }
    await moveDeal(pendingLostMove, DealStage.LOST, lostReason);
    setPendingLostMove(null);
    setLostReason("");
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Deals.</Alert>;
  }

  if (dealsQuery.isLoading) {
    return <SkeletonCard />;
  }

  const deals = dealsQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {pendingLostMove ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="text-body-sm w-full text-neutral-700 dark:text-neutral-300">
            Mark &ldquo;{pendingLostMove.title}&rdquo; as Lost — a reason is required.
          </p>
          <Select
            aria-label="Lost reason"
            value={lostReason}
            onChange={(event) => setLostReason(event.target.value as DealLostReason)}
          >
            <option value="">Choose a reason…</option>
            {LOST_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void confirmLostMove()}
          >
            Confirm Lost
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPendingLostMove(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto md:pb-2">
        {COLUMNS.map((stage) => {
          const columnDeals = deals.filter((d) => d.stage === stage);
          const totalValue = columnDeals.reduce((sum, d) => sum + d.value, 0);
          return (
            <PipelineColumn
              key={stage}
              title={stage}
              count={columnDeals.length}
              totalValue={
                columnDeals.length > 0
                  ? `${columnDeals[0]?.currency ?? ""} ${totalValue.toLocaleString()}`
                  : undefined
              }
              isDropTarget={dragOverColumn === stage}
              onDragOver={(event) => {
                if (!canEdit) return;
                event.preventDefault();
                setDragOverColumn(stage);
              }}
              onDragLeave={() =>
                setDragOverColumn((current) => (current === stage ? null : current))
              }
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(stage);
              }}
            >
              {columnDeals.map((deal) => (
                <DealTile
                  key={deal.id}
                  title={deal.title}
                  value={deal.value}
                  currency={deal.currency}
                  probability={deal.probability}
                  draggable={canEdit && getValidDealTransitions(deal.stage).length > 0}
                  onDragStart={() => setDraggedDeal(deal)}
                  onDragEnd={() => setDraggedDeal(null)}
                  onClick={() => router.push(`/crm/deals/${deal.id}`)}
                />
              ))}
            </PipelineColumn>
          );
        })}
      </div>
    </div>
  );
}
