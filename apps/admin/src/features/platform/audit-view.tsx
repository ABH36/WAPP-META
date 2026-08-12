"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PlatformPermission } from "@wapp/shared-types";
import { Alert, Button, EmptyState, Input, SkeletonCard, Timeline, TimelineItem } from "@wapp/ui";
import { auditService } from "../../services/audit.service";
import { useHasPlatformPermission } from "../../lib/permissions";

const PAGE_SIZE = 25;

/**
 * FRD-001 Volume-8 §4.7 — Global Audit Center. `VIEW_GLOBAL_AUDIT`,
 * read-only. Filters by raw `eventType` string and `workspaceId` only —
 * no `category` param exists. Only Break-Glass + a curated subset of
 * Platform Actions are natively persisted here; Billing Operations and
 * Workspace Actions are deliberately NOT merged in (Architecture Review,
 * 2026-08-12: no client-side event merging or synthetic timeline).
 */
export function AuditView(): React.JSX.Element {
  const canView = useHasPlatformPermission(PlatformPermission.VIEW_GLOBAL_AUDIT);
  const [workspaceId, setWorkspaceId] = React.useState("");
  const [eventType, setEventType] = React.useState("");
  const [page, setPage] = React.useState(1);

  const auditQuery = useQuery({
    queryKey: ["platform", "audit", workspaceId, eventType, page],
    queryFn: () =>
      auditService.list({
        workspaceId: workspaceId || undefined,
        eventType: eventType || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to the Global Audit Center.</Alert>;
  }

  const entries = auditQuery.data?.items ?? [];
  const total = auditQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Filter by workspace ID"
          placeholder="Filter by workspace ID…"
          value={workspaceId}
          onChange={(e) => {
            setPage(1);
            setWorkspaceId(e.target.value);
          }}
          className="max-w-xs"
        />
        <Input
          aria-label="Filter by event type"
          placeholder="Filter by event type…"
          value={eventType}
          onChange={(e) => {
            setPage(1);
            setEventType(e.target.value);
          }}
          className="max-w-xs"
        />
      </div>

      {auditQuery.isLoading ? (
        <SkeletonCard />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No audit entries"
          description="Entries matching these filters will appear here."
        />
      ) : (
        <Timeline>
          {entries.map((entry, index) => (
            <TimelineItem key={entry.id} last={index === entries.length - 1}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-medium text-neutral-900 dark:text-neutral-50">
                    {entry.eventType}
                  </span>
                  <span className="text-caption text-neutral-400 dark:text-neutral-500">
                    {new Date(entry.occurredAt).toLocaleString()}
                  </span>
                </div>
                <span className="text-body-sm text-neutral-600 dark:text-neutral-300">
                  {entry.description}
                </span>
                {entry.workspaceId ? (
                  <span className="text-caption text-neutral-400 dark:text-neutral-500">
                    Workspace {entry.workspaceId}
                  </span>
                ) : null}
              </div>
            </TimelineItem>
          ))}
        </Timeline>
      )}

      {total > PAGE_SIZE ? (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-caption text-neutral-500 dark:text-neutral-400">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
