"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ActivityType } from "@wapp/shared-types";
import { Button, Select, SkeletonCard } from "@wapp/ui";
import { activityService } from "../../services/activity.service";
import { useActivityViewPermission } from "../../lib/permissions";
import {
  getCalendarDays,
  getCalendarRange,
  isSameDay,
  toDateInputValue,
  type CalendarViewMode,
} from "../../lib/calendar-range";
import type { ActivitySummary } from "../../types/activity";

interface CalendarChipProps {
  activity: ActivitySummary;
}

function CalendarChip({ activity }: CalendarChipProps): React.JSX.Element | null {
  const canView = useActivityViewPermission(activity.customerId, activity.dealId);
  if (!canView) return null;

  const href = activity.customerId
    ? `/crm/customers/${activity.customerId}`
    : activity.dealId
      ? `/crm/deals/${activity.dealId}`
      : null;
  const label = activity.title ?? activity.type;
  const chipClass =
    activity.type === ActivityType.TASK
      ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200"
      : "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-200";

  const chip = (
    <span
      className={`text-caption block truncate rounded px-1.5 py-0.5 ${chipClass}`}
      title={label}
    >
      {label}
    </span>
  );
  return href ? (
    <Link href={href} className="block">
      {chip}
    </Link>
  ) : (
    chip
  );
}

/**
 * FRD-001 Volume-5 §4.9 — Tasks + Follow-ups only (approved scope decision;
 * Meetings/Calls/Emails filed as Tech Debt). `dueFrom`/`dueTo` filters Task
 * server-side; Follow-up's `followUpDate` has no server-side range filter
 * (`activity.service.ts` doc comment), so Follow-ups are fetched broadly
 * and matched to a day client-side. Each chip self-gates visibility via
 * `useActivityViewPermission`, same "hide entirely" pattern as the
 * standalone Activities list — a Calendar entry the viewer can't access
 * simply never renders.
 */
export function CalendarView(): React.JSX.Element {
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>("month");
  const [anchor, setAnchor] = React.useState(() => new Date());

  const { start, end } = getCalendarRange(viewMode, anchor);
  const days = getCalendarDays(start, end);

  const tasksQuery = useQuery({
    queryKey: ["crm", "calendar", "tasks", toDateInputValue(start), toDateInputValue(end)],
    queryFn: () =>
      activityService.list({
        type: ActivityType.TASK,
        dueFrom: toDateInputValue(start),
        dueTo: toDateInputValue(end),
        limit: 200,
      }),
  });

  const followUpsQuery = useQuery({
    queryKey: ["crm", "calendar", "followups"],
    queryFn: () => activityService.list({ type: ActivityType.FOLLOW_UP, limit: 200 }),
  });

  const isLoading = tasksQuery.isLoading || followUpsQuery.isLoading;

  const itemsForDay = (day: Date): ActivitySummary[] => {
    const tasks = (tasksQuery.data?.items ?? []).filter(
      (a) => a.dueDate && isSameDay(new Date(a.dueDate), day),
    );
    const followUps = (followUpsQuery.data?.items ?? []).filter(
      (a) => a.followUpDate && isSameDay(new Date(a.followUpDate), day),
    );
    return [...tasks, ...followUps];
  };

  const shift = (direction: 1 | -1) => {
    setAnchor((current) => {
      const next = new Date(current);
      if (viewMode === "day") next.setDate(next.getDate() + direction);
      else if (viewMode === "week") next.setDate(next.getDate() + direction * 7);
      else next.setMonth(next.getMonth() + direction);
      return next;
    });
  };

  const columns = viewMode === "day" ? 1 : 7;
  const headerLabel = anchor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    ...(viewMode === "day" ? { weekday: "long", day: "numeric" } : {}),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => shift(-1)}
            aria-label="Previous"
          >
            ←
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => shift(1)}
            aria-label="Next"
          >
            →
          </Button>
          <span className="text-body-sm font-medium text-neutral-900 dark:text-neutral-50">
            {headerLabel}
          </span>
        </div>
        <Select
          aria-label="Calendar view"
          className="w-32"
          value={viewMode}
          onChange={(event) => setViewMode(event.target.value as CalendarViewMode)}
        >
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </Select>
      </div>

      {isLoading ? (
        <SkeletonCard />
      ) : (
        <div className="overflow-x-auto">
          <div
            className={`grid gap-2 ${columns > 1 ? "min-w-[640px] md:min-w-0" : ""}`}
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {days.map((day) => {
              const inCurrentMonth = viewMode !== "month" || day.getMonth() === anchor.getMonth();
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={`flex min-h-24 flex-col gap-1 rounded-lg border p-2 ${
                    isToday
                      ? "border-brand-500 dark:border-brand-500"
                      : "border-neutral-200 dark:border-neutral-800"
                  } ${inCurrentMonth ? "" : "opacity-40"}`}
                >
                  <span className="text-caption font-medium text-neutral-500 dark:text-neutral-400">
                    {viewMode === "day" ? day.toLocaleDateString() : day.getDate()}
                  </span>
                  {itemsForDay(day).map((activity) => (
                    <CalendarChip key={activity.id} activity={activity} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
