"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Select,
  SkeletonCard,
  StageBadge,
  Timeline,
  TimelineItem,
} from "@wapp/ui";
import { auditService } from "../../services/audit.service";
import { useHasPermission } from "../../lib/permissions";
import { AuditCategory, AuditResult } from "../../types/settings";

const CATEGORY_OPTIONS = Object.values(AuditCategory);
const PAGE_SIZE = 20;

/**
 * FRD-001 Volume-7 §4.10 — `EDIT_WORKSPACE`. Category filter + pagination
 * only — no free-text search box, since `AuditLogQueryDto` has no search
 * parameter (Architecture Review, 2026-08-12). Composes the existing
 * `Timeline`/`TimelineItem` primitives (Volume-5) directly rather than a
 * new "AuditTimeline" component, matching the ReportCard/ForecastCard
 * precedent.
 */
export function AuditLogView(): React.JSX.Element {
  const canView = useHasPermission(Permission.EDIT_WORKSPACE);
  const [category, setCategory] = React.useState<AuditCategory | "">("");
  const [page, setPage] = React.useState(1);

  const auditQuery = useQuery({
    queryKey: ["settings", "audit-logs", category, page],
    queryFn: () => auditService.list({ category: category || undefined, page, limit: PAGE_SIZE }),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Audit Logs.</Alert>;
  }

  const entries = auditQuery.data?.items ?? [];
  const total = auditQuery.data?.total ?? 0;
  const hasNextPage = page * PAGE_SIZE < total;

  return (
    <div className="flex flex-col gap-4">
      <Select
        aria-label="Filter by category"
        className="w-56"
        value={category}
        onChange={(e) => {
          setCategory(e.target.value as AuditCategory | "");
          setPage(1);
        }}
      >
        <option value="">All categories</option>
        {CATEGORY_OPTIONS.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </Select>

      {auditQuery.isLoading ? (
        <SkeletonCard />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No audit log entries"
          description="Entries matching these filters will appear here."
        />
      ) : (
        <Timeline>
          {entries.map((entry, index) => (
            <TimelineItem key={entry.id} last={index === entries.length - 1}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-body-sm font-medium text-neutral-900 dark:text-neutral-50">
                  {entry.module} · {entry.action}
                </span>
                <div className="flex items-center gap-2">
                  <StageBadge value={entry.category} />
                  <Badge variant={entry.result === AuditResult.SUCCESS ? "success" : "danger"}>
                    {entry.result}
                  </Badge>
                </div>
              </div>
              <p className="text-caption text-neutral-500 dark:text-neutral-400">
                {entry.actorId ?? "System"} · {entry.ipAddress ?? "—"} ·{" "}
                {new Date(entry.createdAt).toLocaleString()}
              </p>
            </TimelineItem>
          ))}
        </Timeline>
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
