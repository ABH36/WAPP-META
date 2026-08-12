"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, HealthStatusCard, SkeletonCard } from "@wapp/ui";
import { diagnosticsService } from "../../services/diagnostics.service";
import { useHasPermission } from "../../lib/permissions";

/** FRD-001 Volume-7 §4.12 — `VIEW_REPORTS`, read-only (BR-007). Five of six checks (database/redis/queue/storage/email) are platform-level, identical for every workspace; only `whatsapp` is workspace-specific. */
export function DiagnosticsView(): React.JSX.Element {
  const canView = useHasPermission(Permission.VIEW_REPORTS);

  const diagnosticsQuery = useQuery({
    queryKey: ["settings", "diagnostics"],
    queryFn: () => diagnosticsService.get(),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Diagnostics.</Alert>;
  }

  if (diagnosticsQuery.isLoading || !diagnosticsQuery.data) {
    return <SkeletonCard />;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-caption text-neutral-500 dark:text-neutral-400">
        Last checked {new Date(diagnosticsQuery.data.checkedAt).toLocaleString()}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {diagnosticsQuery.data.checks.map((check) => (
          <HealthStatusCard key={check.name} name={check.name} status={check.status} />
        ))}
      </div>
    </div>
  );
}
