"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Inbox, MessageSquare, Radio, Send } from "lucide-react";
import { ConversationCard, SkeletonCard, SummaryCard } from "@wapp/ui";
import { conversationService } from "../../services/conversation.service";
import { campaignService } from "../../services/campaign.service";
import { useHasPermission } from "../../lib/permissions";

/**
 * FRD-001 Volume-4 §4.1 — composed from existing endpoints only, no new
 * aggregation logic and no dedicated dashboard endpoint (Architecture
 * Review, 2026-08-11 — see docs/TECH-DEBT.md, "Communication dashboard
 * aggregation endpoint"). Counts use `status`-filtered `?limit=1` calls
 * reading `meta.totalRecords` — "Assigned" is interpreted as
 * `status === "ASSIGNED"` (a real, directly-queryable conversation state),
 * not "has any assignee," which the API has no way to count in one call.
 * "Recent Activity" substitutes the conversation list's own default
 * ordering (`lastMessageAt` desc) — no activity-feed endpoint exists.
 * "New Conversation" (named as a Quick Action in the original FRD) isn't
 * built as its own flow this volume — starting a conversation with a
 * brand-new contact needs a phone-number picker plus a mandatory template
 * (no prior message means no compliance window is open), which was judged
 * more scope than a "quick action" — Inbox is linked instead.
 *
 * Conversation-derived cards/links (Inbox) and Campaign/Broadcast/
 * Template-derived cards/links are gated independently
 * (`REPLY_CONVERSATIONS` vs. `VIEW_BROADCASTS`/`VIEW_TEMPLATES`) and
 * hidden entirely when not granted — `MARKETING_EXECUTIVE` has full
 * Campaign/Template access but zero Inbox access, the inverse of
 * `SALES_EXECUTIVE`/`SUPPORT_MANAGER`/`SUPPORT_EXECUTIVE`.
 */
export function CommunicationDashboard(): React.JSX.Element {
  const canViewConversations = useHasPermission(Permission.REPLY_CONVERSATIONS);
  const canViewBroadcasts = useHasPermission(Permission.VIEW_BROADCASTS);
  const canViewTemplates = useHasPermission(Permission.VIEW_TEMPLATES);

  const totalQuery = useQuery({
    queryKey: ["communication", "dashboard", "total"],
    queryFn: () => conversationService.list({ page: 1, limit: 1 }),
    enabled: canViewConversations,
  });
  const openQuery = useQuery({
    queryKey: ["communication", "dashboard", "open"],
    queryFn: () => conversationService.list({ status: "OPEN", page: 1, limit: 1 }),
    enabled: canViewConversations,
  });
  const closedQuery = useQuery({
    queryKey: ["communication", "dashboard", "closed"],
    queryFn: () => conversationService.list({ status: "CLOSED", page: 1, limit: 1 }),
    enabled: canViewConversations,
  });
  const assignedQuery = useQuery({
    queryKey: ["communication", "dashboard", "assigned"],
    queryFn: () => conversationService.list({ status: "ASSIGNED", page: 1, limit: 1 }),
    enabled: canViewConversations,
  });
  const recentQuery = useQuery({
    queryKey: ["communication", "dashboard", "recent"],
    queryFn: () => conversationService.list({ page: 1, limit: 5 }),
    enabled: canViewConversations,
  });
  const campaignsQuery = useQuery({
    queryKey: ["communication", "dashboard", "campaigns"],
    queryFn: () => campaignService.list(),
    enabled: canViewBroadcasts,
  });

  const activeCampaignCount = (campaignsQuery.data ?? []).filter(
    (c) => c.status === "ACTIVE",
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {canViewConversations ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total conversations"
            value={totalQuery.data?.meta.totalRecords ?? "—"}
          />
          <SummaryCard label="Open" value={openQuery.data?.meta.totalRecords ?? "—"} />
          <SummaryCard label="Assigned" value={assignedQuery.data?.meta.totalRecords ?? "—"} />
          <SummaryCard label="Closed" value={closedQuery.data?.meta.totalRecords ?? "—"} />
        </div>
      ) : null}

      {canViewBroadcasts ? (
        <SummaryCard
          icon={<Radio className="h-4 w-4" aria-hidden />}
          label="Campaigns"
          value={`${activeCampaignCount} active`}
          className="max-w-xs"
        />
      ) : null}

      <div className="flex flex-wrap gap-3">
        {canViewConversations ? (
          <Link
            href="/communication/inbox"
            className="text-body-sm text-brand-600 flex items-center gap-1 hover:underline"
          >
            <Inbox className="h-4 w-4" aria-hidden /> Inbox
          </Link>
        ) : null}
        {canViewBroadcasts ? (
          <>
            <Link
              href="/communication/broadcasts"
              className="text-body-sm text-brand-600 flex items-center gap-1 hover:underline"
            >
              <Send className="h-4 w-4" aria-hidden /> Broadcasts
            </Link>
            <Link
              href="/communication/campaigns"
              className="text-body-sm text-brand-600 flex items-center gap-1 hover:underline"
            >
              <Radio className="h-4 w-4" aria-hidden /> Campaigns
            </Link>
          </>
        ) : null}
        {canViewTemplates ? (
          <Link
            href="/communication/templates"
            className="text-body-sm text-brand-600 flex items-center gap-1 hover:underline"
          >
            <MessageSquare className="h-4 w-4" aria-hidden /> Templates
          </Link>
        ) : null}
      </div>

      {canViewConversations ? (
        <div>
          <h2 className="text-h3 mb-2 text-neutral-900 dark:text-neutral-50">Recent activity</h2>
          {recentQuery.isLoading ? (
            <SkeletonCard />
          ) : (
            <div className="flex flex-col gap-3">
              {(recentQuery.data?.items ?? []).map((conversation) => (
                <ConversationCard
                  key={conversation.id}
                  contactName={conversation.contactName}
                  contactPhoneNumber={conversation.contactPhoneNumber}
                  status={conversation.status}
                  lastMessageAt={conversation.lastMessageAt}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
