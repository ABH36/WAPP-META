"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Permission, WorkspaceStatus } from "@wapp/shared-types";
import { Card, SkeletonText, WorkspaceStatusBadge } from "@wapp/ui";
import { workspaceService } from "../../services/workspace.service";
import { useHasPermission } from "../../lib/permissions";

const QUICK_ACTIONS = [
  { href: "/workspace/profile", label: "Edit business profile", requiresEdit: false },
  { href: "/workspace/business-hours", label: "Business hours", requiresEdit: false },
  { href: "/workspace/branding", label: "Branding", requiresEdit: true },
  { href: "/workspace/preferences", label: "Preferences", requiresEdit: true },
];

/**
 * FRD-001 Volume-3 §4.1 — Workspace Name/Status/Created Date come from
 * `GET /workspaces/me` (`VIEW_WORKSPACE`, readable by every role).
 * "Trial Status" is derived purely from the same `status` field (no
 * `trialEndsAt` dependency — that lives on `SubscriptionSummary`, gated
 * `BILLING_ACCESS`, which not every role has; this panel stays readable
 * by everyone). "Last Updated" was dropped — not exposed by
 * `WorkspaceProfile` (Architecture Review, 2026-08-10).
 */
export function WorkspaceIdentityPanel(): React.JSX.Element {
  const canEditWorkspace = useHasPermission(Permission.EDIT_WORKSPACE);
  const workspaceQuery = useQuery({
    queryKey: ["workspace", "current"],
    queryFn: () => workspaceService.current(),
  });

  if (workspaceQuery.isLoading) {
    return (
      <Card>
        <SkeletonText lines={4} />
      </Card>
    );
  }

  const workspace = workspaceQuery.data;
  if (!workspace) {
    return <Card>Unable to load workspace details.</Card>;
  }

  const quickActions = QUICK_ACTIONS.filter((action) => !action.requiresEdit || canEditWorkspace);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h2 text-neutral-900 dark:text-neutral-50">{workspace.name}</h2>
        <WorkspaceStatusBadge status={workspace.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field
          label="Trial status"
          value={workspace.status === WorkspaceStatus.TRIAL ? "On trial" : "Not on trial"}
        />
        <Field label="Created" value={new Date(workspace.createdAt).toLocaleDateString()} />
      </div>

      <div className="flex flex-wrap gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="text-body-sm text-brand-600 hover:underline"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div>
      <p className="text-caption uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="text-body text-neutral-900 dark:text-neutral-50">{value}</p>
    </div>
  );
}
