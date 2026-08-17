"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, Button, ConversationCard, EmptyState, Select, SkeletonCard } from "@wapp/ui";
import { conversationService } from "../../services/conversation.service";
import { teamService } from "../../services/team.service";
import { useHasPermission } from "../../lib/permissions";
import type { ConversationStatus } from "../../types/conversation";

const STATUS_OPTIONS: Array<{ value: ConversationStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "NEW", label: "New" },
  { value: "OPEN", label: "Open" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "PENDING", label: "Pending" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
  { value: "SPAM", label: "Spam" },
  { value: "ARCHIVED", label: "Archived" },
];

const POLL_INTERVAL_MS = 15_000;
const PAGE_SIZE = 20;

interface InboxListProps {
  /** Desktop split-view (§13) passes this to select inline instead of navigating away; omitted on mobile/tablet, where selecting pushes to the full `/communication/conversations/:id` route. */
  onSelectConversation?: (id: string) => void;
  activeConversationId?: string;
}

/**
 * FRD-001 Volume-4 §4.2 — the Inbox. Real-time is polling-only
 * (Architecture Review, 2026-08-11: "TanStack Query polling replaces live
 * push for this volume"). Only `status`/`assignedToUserId` filters exist
 * server-side (ADR-COMM-004) — "Unassigned" has no server-side null-query
 * support, so it's computed client-side over the current page. Pagination
 * is offset-based; "Load more" appends pages rather than true virtualized
 * infinite scroll (deferred — see docs/ADR-FE-008-communication-inbox-strategy.md).
 */
export function InboxList({
  onSelectConversation,
  activeConversationId,
}: InboxListProps): React.JSX.Element {
  const router = useRouter();
  const canView = useHasPermission(Permission.REPLY_CONVERSATIONS);
  const [status, setStatus] = React.useState<ConversationStatus | "">("");
  const [unassignedOnly, setUnassignedOnly] = React.useState(false);

  const conversationsQuery = useInfiniteQuery({
    queryKey: ["communication", "conversations", status],
    queryFn: ({ pageParam }) =>
      conversationService.list({
        status: status || undefined,
        page: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined),
    refetchInterval: POLL_INTERVAL_MS,
    // PHD-001 Volume-3 §17 — makes explicit what was previously only the
    // TanStack Query v5 default: this poller stops while the tab is
    // unfocused, rather than continuing to hit the API in the background.
    refetchIntervalInBackground: false,
    enabled: canView,
  });

  const membersQuery = useQuery({
    queryKey: ["team", "members"],
    queryFn: () => teamService.listMembers(),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to the Shared Inbox.</Alert>;
  }

  const memberNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const member of membersQuery.data ?? []) {
      map.set(member.id, member.fullName);
    }
    return map;
  }, [membersQuery.data]);

  const items = conversationsQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const visibleItems = unassignedOnly ? items.filter((c) => !c.assignedToUserId) : items;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label="Filter by status"
          className="w-48"
          value={status}
          onChange={(event) => setStatus(event.target.value as ConversationStatus | "")}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <label className="text-body-sm flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={unassignedOnly}
            onChange={(event) => setUnassignedOnly(event.target.checked)}
          />
          Unassigned only
        </label>
      </div>

      {conversationsQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title="No conversations"
          description="Conversations matching these filters will appear here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visibleItems.map((conversation) => (
            <ConversationCard
              key={conversation.id}
              contactName={conversation.contactName}
              contactPhoneNumber={conversation.contactPhoneNumber}
              status={conversation.status}
              assignedToLabel={
                conversation.assignedToUserId
                  ? (memberNameById.get(conversation.assignedToUserId) ?? "Assigned")
                  : undefined
              }
              lastMessageAt={conversation.lastMessageAt}
              active={conversation.id === activeConversationId}
              onClick={() =>
                onSelectConversation
                  ? onSelectConversation(conversation.id)
                  : router.push(`/communication/conversations/${conversation.id}`)
              }
            />
          ))}
        </div>
      )}

      {conversationsQuery.hasNextPage ? (
        <Button
          variant="secondary"
          size="sm"
          className="w-fit"
          loading={conversationsQuery.isFetchingNextPage}
          onClick={() => void conversationsQuery.fetchNextPage()}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}
