"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, Badge, BroadcastCard, Button, Card, SkeletonText } from "@wapp/ui";
import { getStatusColor } from "@wapp/ui";
import { campaignService } from "../../services/campaign.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";

interface CampaignDetailProps {
  campaignId: string;
}

/** FRD-001 Volume-4 §4.6 — a Campaign's waves are real, independent Broadcasts (`Broadcast.campaignId`), rendered with the same `BroadcastCard` the standalone Broadcasts screen uses. No per-Campaign send/pause/resume — those actions live on each wave's own Broadcast detail; Campaign only has cancel (cascades to every still-active wave). The read itself is gated `VIEW_BROADCASTS`, same as the list. */
export function CampaignDetail({ campaignId }: CampaignDetailProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.VIEW_BROADCASTS);
  const canCancel = useHasFullPermission(Permission.SEND_BROADCAST);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState(false);

  const campaignQuery = useQuery({
    queryKey: ["communication", "campaign", campaignId],
    queryFn: () => campaignService.getById(campaignId),
    enabled: canView,
  });
  const wavesQuery = useQuery({
    queryKey: ["communication", "campaign", campaignId, "waves"],
    queryFn: () => campaignService.listWaves(campaignId),
    enabled: canView,
  });
  const statsQuery = useQuery({
    queryKey: ["communication", "campaign", campaignId, "stats"],
    queryFn: () => campaignService.getStats(campaignId),
    refetchInterval: 15_000,
    // PHD-001 Volume-3 §17 — makes explicit what was previously only the
    // TanStack Query v5 default: this poller stops while the tab is
    // unfocused, rather than continuing to hit the API in the background.
    refetchIntervalInBackground: false,
    enabled: canView,
  });

  const handleCancel = async () => {
    setActionError(null);
    setActing(true);
    try {
      await campaignService.cancel(campaignId);
      await queryClient.invalidateQueries({ queryKey: ["communication", "campaign", campaignId] });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel campaign.");
    } finally {
      setActing(false);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Campaigns.</Alert>;
  }

  if (campaignQuery.isLoading) {
    return <SkeletonText lines={6} />;
  }

  const campaign = campaignQuery.data;
  if (!campaign) {
    return <Alert variant="danger">Unable to load this campaign.</Alert>;
  }

  const stats = statsQuery.data;

  return (
    <div className="flex flex-col gap-4">
      {actionError ? <Alert variant="danger">{actionError}</Alert> : null}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-h2 text-neutral-900 dark:text-neutral-50">{campaign.name}</h2>
          <Badge variant={getStatusColor(campaign.status)}>{campaign.status}</Badge>
        </div>
        {stats ? (
          <p className="text-body-sm text-neutral-600 dark:text-neutral-400">
            {stats.waveCount} wave{stats.waveCount === 1 ? "" : "s"} · Send progress: {stats.sent}{" "}
            sent · {stats.pending} pending · {stats.failed} failed · {stats.total} total
          </p>
        ) : null}
        {canCancel && campaign.status === "ACTIVE" ? (
          <Button
            variant="destructive"
            size="sm"
            className="w-fit"
            loading={acting}
            onClick={() => void handleCancel()}
          >
            Cancel campaign
          </Button>
        ) : null}
      </Card>

      <div>
        <h3 className="text-h3 mb-2 text-neutral-900 dark:text-neutral-50">Waves</h3>
        {wavesQuery.isLoading ? (
          <SkeletonText lines={3} />
        ) : (
          <div className="flex flex-col gap-3">
            {(wavesQuery.data ?? []).map((wave) => (
              <BroadcastCard
                key={wave.id}
                name={wave.name}
                status={wave.status}
                scheduledAt={wave.scheduledAt}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
