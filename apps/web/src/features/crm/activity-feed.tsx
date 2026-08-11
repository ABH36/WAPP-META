"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityType } from "@wapp/shared-types";
import { Alert, Button, SkeletonText, Textarea, Timeline, TimelineItem } from "@wapp/ui";
import { activityService } from "../../services/activity.service";
import { useActivityEditPermission, useActivityViewPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";

interface ActivityFeedProps {
  customerId?: string;
  dealId?: string;
}

/**
 * FRD-001 Volume-5 §4.6/§4.7/§4.8 — a reusable per-entity Activity feed
 * (Customer/Deal profile), Timeline-style. Composes `activityService.list`
 * filtered by whichever entity ref is passed — permission is computed via
 * `useActivityViewPermission`/`useActivityEditPermission` (AND across
 * both refs when both are set, matching the backend exactly).
 */
export function ActivityFeed({ customerId, dealId }: ActivityFeedProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useActivityViewPermission(customerId ?? null, dealId ?? null);
  const canEdit = useActivityEditPermission(customerId ?? null, dealId ?? null);
  const [noteText, setNoteText] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const queryKey = ["crm", "activities", "for", customerId ?? "", dealId ?? ""];

  const activitiesQuery = useQuery({
    queryKey,
    queryFn: () =>
      activityService.list({
        customerId,
        dealId,
        sortBy: "createdAt",
        sortOrder: "desc",
        page: 1,
        limit: 20,
      }),
    enabled: canView,
  });

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setError(null);
    setPosting(true);
    try {
      await activityService.createNote({ customerId, dealId, text: noteText.trim() });
      setNoteText("");
      await queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add note.");
    } finally {
      setPosting(false);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Activities for this record.</Alert>;
  }

  const activities = activitiesQuery.data?.items ?? [];

  return (
    <div>
      <h3 className="text-h3 mb-2 text-neutral-900 dark:text-neutral-50">Activity timeline</h3>
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {canEdit ? (
        <div className="mb-4 flex items-end gap-2">
          <Textarea
            aria-label="Add a note"
            className="min-h-9 flex-1"
            placeholder="Add a note…"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={posting}
            onClick={() => void handleAddNote()}
          >
            Add note
          </Button>
        </div>
      ) : null}

      {activitiesQuery.isLoading ? (
        <SkeletonText lines={3} />
      ) : activities.length === 0 ? (
        <p className="text-body-sm text-neutral-500 dark:text-neutral-400">No activity yet.</p>
      ) : (
        <Timeline>
          {activities.map((activity, index) => (
            <TimelineItem key={activity.id} last={index === activities.length - 1}>
              <p className="text-body-sm font-medium text-neutral-900 dark:text-neutral-50">
                {activity.type === ActivityType.NOTE
                  ? activity.text
                  : (activity.title ?? activity.type)}
              </p>
              <p className="text-caption text-neutral-500 dark:text-neutral-400">
                {activity.type} · {new Date(activity.createdAt).toLocaleString()}
              </p>
            </TimelineItem>
          ))}
        </Timeline>
      )}
    </div>
  );
}
