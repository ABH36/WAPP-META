"use client";

import * as React from "react";
import Link from "next/link";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityType, TaskStatus } from "@wapp/shared-types";
import { ActivityCard, Alert, Button, EmptyState, Select, SkeletonCard } from "@wapp/ui";
import { activityService } from "../../services/activity.service";
import { useActivityEditPermission, useActivityViewPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import type { ActivitySummary } from "../../types/activity";

const TYPE_OPTIONS: Array<{ value: ActivityType | ""; label: string }> = [
  { value: "", label: "All types" },
  { value: ActivityType.TASK, label: "Tasks" },
  { value: ActivityType.FOLLOW_UP, label: "Follow-ups" },
  { value: ActivityType.NOTE, label: "Notes" },
  { value: ActivityType.REMINDER, label: "Reminders" },
  { value: ActivityType.CALL, label: "Calls" },
  { value: ActivityType.MEETING, label: "Meetings" },
  { value: ActivityType.EMAIL, label: "Emails" },
];

const TASK_STATUS_OPTIONS: Array<{ value: TaskStatus | ""; label: string }> = [
  { value: "", label: "Any status" },
  { value: TaskStatus.PENDING, label: "Pending" },
  { value: TaskStatus.IN_PROGRESS, label: "In progress" },
  { value: TaskStatus.COMPLETED, label: "Completed" },
  { value: TaskStatus.CANCELLED, label: "Cancelled" },
];

const PAGE_SIZE = 20;

function activityTitle(activity: ActivitySummary): string {
  if (activity.type === ActivityType.NOTE) return activity.text ?? "Note";
  return activity.title ?? activity.type;
}

function activitySubtitle(activity: ActivitySummary): string | undefined {
  if (activity.type === ActivityType.TASK && activity.dueDate) {
    return `Due ${new Date(activity.dueDate).toLocaleDateString()}${activity.priority ? ` · ${activity.priority}` : ""}`;
  }
  if (activity.type === ActivityType.FOLLOW_UP && activity.followUpDate) {
    return `${activity.followUpType ?? "Follow-up"} on ${new Date(activity.followUpDate).toLocaleDateString()}`;
  }
  if (activity.type === ActivityType.REMINDER && activity.reminderDate) {
    return `Reminder on ${new Date(activity.reminderDate).toLocaleDateString()}`;
  }
  return activity.description ?? undefined;
}

interface ActivityRowProps {
  activity: ActivitySummary;
  onChanged: (updated: ActivitySummary) => void;
}

/**
 * FRD-001 Volume-5 §4.6/§4.7/§4.8 — the Activities controller has no
 * permission of its own; each row must self-gate via
 * `useActivityViewPermission`/`useActivityEditPermission` per its own
 * `customerId`/`dealId`, since a list may freely mix activities the
 * viewer can and cannot see (ADR-CRM-016/017). There's no standalone
 * Activity detail route (unlike Leads/Customers/Deals) — the link goes to
 * whichever related Customer/Deal record the activity references, and
 * Task/Follow-up completion happens inline here.
 */
function ActivityRow({ activity, onChanged }: ActivityRowProps): React.JSX.Element | null {
  const canView = useActivityViewPermission(activity.customerId, activity.dealId);
  const canEdit = useActivityEditPermission(activity.customerId, activity.dealId);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!canView) return null;

  const relatedHref = activity.customerId
    ? `/crm/customers/${activity.customerId}`
    : activity.dealId
      ? `/crm/deals/${activity.dealId}`
      : null;

  const handleTaskStatusChange = async (status: TaskStatus) => {
    setError(null);
    setBusy(true);
    try {
      const updated = await activityService.updateTaskStatus(activity.id, status);
      onChanged(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update task.");
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteFollowUp = async () => {
    setError(null);
    setBusy(true);
    try {
      const updated = await activityService.completeFollowUp(activity.id);
      onChanged(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to complete follow-up.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <ActivityCard
        type={activity.type}
        title={activityTitle(activity)}
        subtitle={activitySubtitle(activity)}
        statusLabel={
          activity.type === ActivityType.TASK ? (activity.status ?? undefined) : undefined
        }
        timestamp={activity.createdAt}
      />
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <div className="flex flex-wrap items-center gap-2 pl-11">
        {relatedHref ? (
          <Link href={relatedHref} className="text-caption text-brand-600 hover:underline">
            View related record →
          </Link>
        ) : null}
        {canEdit &&
        activity.type === ActivityType.TASK &&
        activity.status !== TaskStatus.COMPLETED ? (
          <Select
            aria-label="Task status"
            className="text-caption h-8 w-40"
            disabled={busy}
            value={activity.status ?? TaskStatus.PENDING}
            onChange={(event) => void handleTaskStatusChange(event.target.value as TaskStatus)}
          >
            {TASK_STATUS_OPTIONS.filter((option) => option.value).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : null}
        {canEdit && activity.type === ActivityType.FOLLOW_UP && !activity.followUpCompletedAt ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={busy}
            onClick={() => void handleCompleteFollowUp()}
          >
            Mark complete
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ActivityList(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [type, setType] = React.useState<ActivityType | "">("");
  const [status, setStatus] = React.useState<TaskStatus | "">("");

  const queryKey = ["crm", "activities", "all", type, status];

  const activitiesQuery = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      activityService.list({
        type: type || undefined,
        status: status || undefined,
        sortBy: "createdAt",
        sortOrder: "desc",
        page: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined),
  });

  const handleChanged = (updated: ActivitySummary) => {
    queryClient.setQueryData<
      | { pages: Array<{ items: ActivitySummary[]; meta: unknown }>; pageParams: unknown[] }
      | undefined
    >(queryKey, (current) => {
      if (!current) return current;
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => (item.id === updated.id ? updated : item)),
        })),
      };
    });
  };

  const items = activitiesQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Select
          aria-label="Filter by type"
          className="w-44"
          value={type}
          onChange={(event) => setType(event.target.value as ActivityType | "")}
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          className="w-44"
          value={status}
          onChange={(event) => setStatus(event.target.value as TaskStatus | "")}
        >
          {TASK_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {activitiesQuery.isLoading ? (
        <SkeletonCard />
      ) : items.length === 0 ? (
        <EmptyState
          title="No activities"
          description="Activities matching these filters will appear here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} onChanged={handleChanged} />
          ))}
        </div>
      )}

      {activitiesQuery.hasNextPage ? (
        <Button
          variant="secondary"
          size="sm"
          className="w-fit"
          loading={activitiesQuery.isFetchingNextPage}
          onClick={() => void activitiesQuery.fetchNextPage()}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}
