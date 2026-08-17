"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, Badge, Button, Card, SkeletonText } from "@wapp/ui";
import { getStatusColor } from "@wapp/ui";
import { broadcastService } from "../../services/broadcast.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import type { BroadcastStatus } from "../../types/broadcast";

interface BroadcastDetailProps {
  broadcastId: string;
}

const TERMINAL_STATUSES: BroadcastStatus[] = ["COMPLETED", "CANCELLED", "FAILED"];

/** FRD-001 Volume-4 §4.6 — status-transition actions only (send/pause/resume/cancel); no edit route exists. Stats are "Send Progress" (Layer 1 — accepted-by-Meta counts), never "Delivery Summary". The read itself is gated `VIEW_BROADCASTS`, same as the list. */
export function BroadcastDetail({ broadcastId }: BroadcastDetailProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.VIEW_BROADCASTS);
  const canSend = useHasFullPermission(Permission.SEND_BROADCAST);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState(false);

  const broadcastQuery = useQuery({
    queryKey: ["communication", "broadcast", broadcastId],
    queryFn: () => broadcastService.getById(broadcastId),
    enabled: canView,
  });
  const statsQuery = useQuery({
    queryKey: ["communication", "broadcast", broadcastId, "stats"],
    queryFn: () => broadcastService.getStats(broadcastId),
    refetchInterval: 15_000,
    // PHD-001 Volume-3 §17 — makes explicit what was previously only the
    // TanStack Query v5 default: this poller stops while the tab is
    // unfocused, rather than continuing to hit the API in the background.
    refetchIntervalInBackground: false,
    enabled: canView,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["communication", "broadcast", broadcastId] });

  const runAction = async (action: () => Promise<unknown>) => {
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
    return <Alert variant="info">You don&apos;t have access to Broadcasts.</Alert>;
  }

  if (broadcastQuery.isLoading) {
    return <SkeletonText lines={6} />;
  }

  const broadcast = broadcastQuery.data;
  if (!broadcast) {
    return <Alert variant="danger">Unable to load this broadcast.</Alert>;
  }

  const stats = statsQuery.data;

  return (
    <div className="flex flex-col gap-4">
      {actionError ? <Alert variant="danger">{actionError}</Alert> : null}
      {broadcast.failureReason ? <Alert variant="danger">{broadcast.failureReason}</Alert> : null}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-h2 text-neutral-900 dark:text-neutral-50">{broadcast.name}</h2>
          <Badge variant={getStatusColor(broadcast.status)}>{broadcast.status}</Badge>
        </div>
        {stats ? (
          <p className="text-body-sm text-neutral-600 dark:text-neutral-400">
            Send progress: {stats.sent} sent · {stats.pending} pending · {stats.failed} failed ·{" "}
            {stats.total} total
          </p>
        ) : null}

        {canSend ? (
          <div className="flex flex-wrap gap-2">
            {broadcast.status === "DRAFT" ? (
              <Button
                variant="primary"
                size="sm"
                loading={acting}
                onClick={() => void runAction(() => broadcastService.send(broadcastId))}
              >
                Send now
              </Button>
            ) : null}
            {broadcast.status === "RUNNING" || broadcast.status === "SCHEDULED" ? (
              <Button
                variant="secondary"
                size="sm"
                loading={acting}
                onClick={() => void runAction(() => broadcastService.pause(broadcastId))}
              >
                Pause
              </Button>
            ) : null}
            {broadcast.status === "PAUSED" ? (
              <Button
                variant="secondary"
                size="sm"
                loading={acting}
                onClick={() => void runAction(() => broadcastService.resume(broadcastId))}
              >
                Resume
              </Button>
            ) : null}
            {!TERMINAL_STATUSES.includes(broadcast.status) ? (
              <Button
                variant="destructive"
                size="sm"
                loading={acting}
                onClick={() => void runAction(() => broadcastService.cancel(broadcastId))}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
