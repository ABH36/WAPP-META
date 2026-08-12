"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlatformPermission } from "@wapp/shared-types";
import {
  Alert,
  BreakGlassCard,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  SkeletonCard,
} from "@wapp/ui";
import { breakGlassService } from "../../services/break-glass.service";
import { useHasPlatformPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import { SupportSessionStatus } from "../../types/platform";

/**
 * FRD-001 Volume-8 §4.6 — Break-Glass. `REQUEST_SUPPORT_ACCESS` to
 * request, `APPROVE_SUPPORT_ACCESS` to approve, `START_SUPPORT_SESSION`
 * to start/end, `VIEW_INVESTIGATION` to list and read the workspace
 * overview. No "Reject" action — a `REQUESTED` session can only ever be
 * approved (Architecture Review, 2026-08-12). Read-only confirmed: the
 * workspace overview panel never writes to tenant data (TD-023).
 */
export function BreakGlassView(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canRequest = useHasPlatformPermission(PlatformPermission.REQUEST_SUPPORT_ACCESS);
  const canApprove = useHasPlatformPermission(PlatformPermission.APPROVE_SUPPORT_ACCESS);
  const canStart = useHasPlatformPermission(PlatformPermission.START_SUPPORT_SESSION);
  const canView = useHasPlatformPermission(PlatformPermission.VIEW_INVESTIGATION);
  const [status, setStatus] = React.useState<SupportSessionStatus | "">("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = React.useState(false);
  const [requestForm, setRequestForm] = React.useState({
    workspaceId: "",
    reason: "",
    durationMinutes: 60,
  });
  const [overviewSessionId, setOverviewSessionId] = React.useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["platform", "support", "sessions", status],
    queryFn: () => breakGlassService.listSessions({ status: status || undefined, limit: 50 }),
    enabled: canView,
    // FRD-001 Volume-9 §4.1/§8 — Break-Glass approvals are a multi-operator
    // coordination surface (one admin requests, another approves); the
    // global 30s staleTime is too coarse for that handoff.
    staleTime: 10_000,
    refetchInterval: 10_000,
  });

  const overviewQuery = useQuery({
    queryKey: ["platform", "support", "workspace-overview", overviewSessionId],
    queryFn: () => {
      const session = sessionsQuery.data?.items.find((s) => s.id === overviewSessionId);
      return breakGlassService.getWorkspaceOverview(session!.workspaceId);
    },
    enabled: canView && !!overviewSessionId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["platform", "support", "sessions"] });

  const handleRequest = async () => {
    if (!requestForm.workspaceId.trim() || requestForm.reason.trim().length < 10) {
      setError("Workspace ID and a reason of at least 10 characters are required.");
      return;
    }
    setError(null);
    setBusy("request");
    try {
      await breakGlassService.requestAccess(
        requestForm.workspaceId.trim(),
        requestForm.reason.trim(),
        requestForm.durationMinutes,
      );
      setRequestForm({ workspaceId: "", reason: "", durationMinutes: 60 });
      setShowRequestForm(false);
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to request access.");
    } finally {
      setBusy(null);
    }
  };

  const handleApprove = async (id: string) => {
    setError(null);
    setBusy(id);
    try {
      await breakGlassService.approveAccess(id);
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to approve access.");
    } finally {
      setBusy(null);
    }
  };

  const handleStart = async (id: string) => {
    setError(null);
    setBusy(id);
    try {
      await breakGlassService.startSession(id);
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start session.");
    } finally {
      setBusy(null);
    }
  };

  const handleEnd = async (id: string) => {
    setError(null);
    setBusy(id);
    try {
      await breakGlassService.endSession(id);
      setOverviewSessionId((current) => (current === id ? null : current));
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to end session.");
    } finally {
      setBusy(null);
    }
  };

  if (!canView && !canRequest) {
    return <Alert variant="info">You don&apos;t have access to Break-Glass.</Alert>;
  }

  const sessions = sessionsQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {canRequest ? (
        showRequestForm ? (
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input
                aria-label="Workspace ID"
                placeholder="Workspace ID"
                value={requestForm.workspaceId}
                onChange={(e) => setRequestForm((f) => ({ ...f, workspaceId: e.target.value }))}
              />
              <Input
                aria-label="Duration (minutes)"
                type="number"
                min={1}
                max={240}
                value={requestForm.durationMinutes}
                onChange={(e) =>
                  setRequestForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))
                }
              />
              <Input
                aria-label="Reason"
                placeholder="Reason (min. 10 characters)"
                value={requestForm.reason}
                onChange={(e) => setRequestForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={busy === "request"}
                onClick={() => void handleRequest()}
              >
                Request access
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowRequestForm(false)}
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
            onClick={() => setShowRequestForm(true)}
          >
            Request access
          </Button>
        )
      ) : null}

      {canView ? (
        <>
          <Select
            aria-label="Filter by status"
            className="w-48"
            value={status}
            onChange={(e) => setStatus(e.target.value as SupportSessionStatus | "")}
          >
            <option value="">All statuses</option>
            {Object.values(SupportSessionStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>

          {sessionsQuery.isLoading ? (
            <SkeletonCard />
          ) : sessions.length === 0 ? (
            <EmptyState
              title="No Break-Glass requests"
              description="Requests matching this filter will appear here."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map((session) => (
                <div key={session.id} className="flex flex-col gap-2">
                  <BreakGlassCard
                    workspaceLabel={`Workspace ${session.workspaceId}`}
                    requestedBy={session.requestedBy}
                    reason={session.reason}
                    durationMinutes={session.durationMinutes}
                    status={session.status}
                    expiresAt={session.expiresAt}
                    actions={
                      <>
                        {canApprove && session.status === SupportSessionStatus.REQUESTED ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            loading={busy === session.id}
                            onClick={() => void handleApprove(session.id)}
                          >
                            Approve
                          </Button>
                        ) : null}
                        {canStart && session.status === SupportSessionStatus.APPROVED ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            loading={busy === session.id}
                            onClick={() => void handleStart(session.id)}
                          >
                            Start Session
                          </Button>
                        ) : null}
                        {canStart && session.status === SupportSessionStatus.ACTIVE ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            loading={busy === session.id}
                            onClick={() => void handleEnd(session.id)}
                          >
                            End Session
                          </Button>
                        ) : null}
                        {session.status === SupportSessionStatus.ACTIVE ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setOverviewSessionId((current) =>
                                current === session.id ? null : session.id,
                              )
                            }
                          >
                            {overviewSessionId === session.id ? "Hide" : "View"} Workspace
                          </Button>
                        ) : null}
                      </>
                    }
                  />
                  {overviewSessionId === session.id ? (
                    overviewQuery.isLoading || !overviewQuery.data ? (
                      <SkeletonCard />
                    ) : (
                      <Card className="ml-4 flex flex-col gap-2">
                        <span className="text-body-sm font-medium text-neutral-900 dark:text-neutral-50">
                          {overviewQuery.data.workspace.name}
                        </span>
                        <span className="text-caption text-neutral-500 dark:text-neutral-400">
                          {overviewQuery.data.users.length} member(s) · Plan{" "}
                          {overviewQuery.data.subscription.planId} ·{" "}
                          {overviewQuery.data.invoices.length} invoice(s)
                        </span>
                        <span className="text-caption text-neutral-500 dark:text-neutral-400">
                          {overviewQuery.data.settingsOverview.businessProfile.description ??
                            "No business description on file"}
                        </span>
                      </Card>
                    )
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
