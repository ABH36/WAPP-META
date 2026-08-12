"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlatformPermission, WorkspaceStatus } from "@wapp/shared-types";
import {
  Alert,
  Button,
  Input,
  Select,
  SkeletonCard,
  StageBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wapp/ui";
import { workspacesService } from "../../services/workspaces.service";
import { useHasFullPlatformPermission, useHasPlatformPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";

const PAGE_SIZE = 20;

/**
 * FRD-001 Volume-8 §4.2 — Workspace Registry. `VIEW_WORKSPACES` for reads,
 * `MANAGE_WORKSPACE_STATUS` for Suspend/Reactivate/Archive (one generic
 * status route). No Plan/Trial Status column — `PlatformWorkspaceSummary`
 * has no such fields (would require a separate `/platform/subscriptions`
 * join per workspace, not attempted here to avoid N+1 fan-out across a
 * paginated list). `q` searches Workspace Name only, not owner. Composes
 * the existing generic `Table` primitives directly — no bespoke
 * "WorkspaceRegistryTable" component was built (Architecture Review,
 * 2026-08-12).
 */
export function WorkspaceRegistryView(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPlatformPermission(PlatformPermission.VIEW_WORKSPACES);
  const canManageStatus = useHasFullPlatformPermission(PlatformPermission.MANAGE_WORKSPACE_STATUS);
  const [status, setStatus] = React.useState<WorkspaceStatus | "">("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<{
    id: string;
    status: WorkspaceStatus;
  } | null>(null);
  const [reason, setReason] = React.useState("");

  const registryQuery = useQuery({
    queryKey: ["platform", "workspaces", status, q, page],
    queryFn: () =>
      workspacesService.list({
        status: status || undefined,
        q: q || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: canView,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["platform", "workspaces"] });

  const applyStatusChange = async (id: string, next: WorkspaceStatus, changeReason?: string) => {
    setError(null);
    setBusy(id);
    try {
      await workspacesService.updateStatus(id, next, changeReason);
      setPendingAction(null);
      setReason("");
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update workspace status.");
    } finally {
      setBusy(null);
    }
  };

  const handleReactivate = (id: string) => void applyStatusChange(id, WorkspaceStatus.ACTIVE);

  const confirmPendingAction = () => {
    if (!pendingAction || !reason.trim()) {
      setError("A reason is required for this status change.");
      return;
    }
    void applyStatusChange(pendingAction.id, pendingAction.status, reason.trim());
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to the Workspace Registry.</Alert>;
  }

  const items = registryQuery.data?.items ?? [];
  const total = registryQuery.data?.total ?? 0;
  const hasNextPage = page * PAGE_SIZE < total;

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {pendingAction ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="max-w-md flex-1">
            <label
              htmlFor="status-reason"
              className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
            >
              Reason for marking this workspace {pendingAction.status}
            </label>
            <Input id="status-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            loading={busy === pendingAction.id}
            onClick={confirmPendingAction}
          >
            Confirm
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setPendingAction(null);
              setReason("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Search by workspace name"
          placeholder="Search by workspace name…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          aria-label="Filter by status"
          className="w-48"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as WorkspaceStatus | "");
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {Object.values(WorkspaceStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {registryQuery.isLoading ? (
        <SkeletonCard />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              {canManageStatus ? <TableHead>Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((workspace) => (
              <TableRow key={workspace.id}>
                <TableCell>{workspace.name}</TableCell>
                <TableCell>{workspace.ownerId}</TableCell>
                <TableCell>
                  <StageBadge value={workspace.status} />
                </TableCell>
                <TableCell>{new Date(workspace.createdAt).toLocaleDateString()}</TableCell>
                {canManageStatus ? (
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {workspace.status === WorkspaceStatus.ACTIVE ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setPendingAction({
                                id: workspace.id,
                                status: WorkspaceStatus.SUSPENDED,
                              })
                            }
                          >
                            Suspend
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setPendingAction({
                                id: workspace.id,
                                status: WorkspaceStatus.ARCHIVED,
                              })
                            }
                          >
                            Archive
                          </Button>
                        </>
                      ) : null}
                      {workspace.status === WorkspaceStatus.SUSPENDED ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            loading={busy === workspace.id}
                            onClick={() => handleReactivate(workspace.id)}
                          >
                            Reactivate
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setPendingAction({
                                id: workspace.id,
                                status: WorkspaceStatus.ARCHIVED,
                              })
                            }
                          >
                            Archive
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </Button>
        <span className="text-caption text-neutral-500 dark:text-neutral-400">Page {page}</span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!hasNextPage}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
