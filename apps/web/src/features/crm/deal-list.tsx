"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { DealStage, Permission } from "@wapp/shared-types";
import { Alert, DealCard, EmptyState, Select, SkeletonCard, Button } from "@wapp/ui";
import { dealService } from "../../services/deal.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";

const STAGE_OPTIONS: Array<{ value: DealStage | ""; label: string }> = [
  { value: "", label: "All stages" },
  { value: DealStage.OPEN, label: "Open" },
  { value: DealStage.QUALIFICATION, label: "Qualification" },
  { value: DealStage.PROPOSAL, label: "Proposal" },
  { value: DealStage.NEGOTIATION, label: "Negotiation" },
  { value: DealStage.WON, label: "Won" },
  { value: DealStage.LOST, label: "Lost" },
];

const PAGE_SIZE = 20;

/**
 * FRD-001 Volume-5 §4.4 — List/Search/Filters/Edit. No "Create" action —
 * no `POST /crm/deals` route exists anywhere; a Deal is created
 * exclusively by converting a Lead (ADR-CRM-010, Architecture Review,
 * 2026-08-11). The "New deal" affordance links to Leads instead of
 * opening a form.
 */
export function DealList(): React.JSX.Element {
  const router = useRouter();
  const canView = useHasPermission(Permission.VIEW_DEALS);
  const canCreateViaLead = useHasFullPermission(Permission.CREATE_LEADS);
  const [stage, setStage] = React.useState<DealStage | "">("");

  const dealsQuery = useInfiniteQuery({
    queryKey: ["crm", "deals", stage],
    queryFn: ({ pageParam }) =>
      dealService.list({ stage: stage || undefined, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Deals.</Alert>;
  }

  const items = dealsQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          aria-label="Filter by stage"
          className="w-48"
          value={stage}
          onChange={(event) => setStage(event.target.value as DealStage | "")}
        >
          {STAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {canCreateViaLead ? (
          <Link href="/crm/leads" className="text-body-sm text-brand-600 hover:underline">
            New deals come from converting a Lead →
          </Link>
        ) : null}
      </div>

      {dealsQuery.isLoading ? (
        <SkeletonCard />
      ) : items.length === 0 ? (
        <EmptyState title="No deals" description="Deals matching these filters will appear here." />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((deal) => (
            <DealCard
              key={deal.id}
              title={deal.title}
              stage={deal.stage}
              value={deal.value}
              currency={deal.currency}
              probability={deal.probability}
              expectedCloseDate={deal.expectedCloseDate}
              onClick={() => router.push(`/crm/deals/${deal.id}`)}
            />
          ))}
        </div>
      )}

      {dealsQuery.hasNextPage ? (
        <Button
          variant="secondary"
          size="sm"
          className="w-fit"
          loading={dealsQuery.isFetchingNextPage}
          onClick={() => void dealsQuery.fetchNextPage()}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}
