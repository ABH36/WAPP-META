"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { LoginHistoryTable, SkeletonCard } from "@wapp/ui";
import { securitySettingsService } from "../../services/security-settings.service";
import { parseUserAgent } from "../../lib/user-agent";
import { formatLoginReason } from "../../lib/login-reason";

/** FRD-001 Volume-2 §4.6 — Login History, read-only. */
export function LoginHistoryList(): React.JSX.Element {
  const historyQuery = useQuery({
    queryKey: ["settings", "login-history"],
    queryFn: () => securitySettingsService.loginHistory(),
  });

  if (historyQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const entries = (historyQuery.data ?? []).map((entry) => {
    const { device, browser } = parseUserAgent(entry.userAgent);
    return {
      id: entry.id,
      success: entry.success,
      reason: entry.reason,
      ipAddress: entry.ipAddress,
      device,
      browser,
      occurredAt: new Date(entry.createdAt).toLocaleString(),
    };
  });

  return <LoginHistoryTable entries={entries} formatReason={formatLoginReason} />;
}
