"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, SkeletonText } from "@wapp/ui";
import { useAuthStore } from "../../stores/auth-store";
import { workspaceService } from "../../services/workspace.service";

/**
 * FRD-001 Volume-2 §4.4 — Profile, fully read-only (Architecture Review,
 * 2026-08-10: no `PATCH` endpoint exists for any profile field, and `User`
 * has no avatar field at all — confirmed, not assumed). Name/Email/Role
 * come from the already-hydrated auth store (no extra request); Workspace
 * name is the one field needing its own call (`GET /workspaces/me`).
 */
export function ProfileOverview(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const workspaceQuery = useQuery({
    queryKey: ["workspace", "current"],
    queryFn: () => workspaceService.current(),
    enabled: !!user?.workspaceId,
  });

  if (!user) {
    return <SkeletonText lines={4} />;
  }

  return (
    <Card className="flex flex-col gap-4">
      <ProfileField label="Name" value={user.fullName} />
      <ProfileField label="Email" value={user.email} />
      <ProfileField label="Role" value={user.role ?? "—"} />
      <ProfileField
        label="Workspace"
        value={workspaceQuery.isLoading ? "Loading…" : (workspaceQuery.data?.name ?? "—")}
      />
    </Card>
  );
}

function ProfileField({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div>
      <p className="text-caption uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="text-body text-neutral-900 dark:text-neutral-50">{value}</p>
    </div>
  );
}
