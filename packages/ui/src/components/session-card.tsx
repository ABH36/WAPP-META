import * as React from "react";
import { Monitor } from "lucide-react";
import { Card } from "./card";
import { Button } from "./button";

/**
 * FRD-001 Volume-2 §4.5 — Active Sessions. Deliberately has no "current
 * session" prop/marking — Architecture Review, 2026-08-10: the backend has
 * no mechanism to identify the requesting session (`SessionSummary` has no
 * `isCurrent`, the access token carries no `jti`), so every session renders
 * identically, each with a plain Revoke action. `device`/`browser` are
 * passed in already-parsed (see each app's own lib/user-agent.ts) — this
 * component has no User-Agent-parsing knowledge of its own.
 */
export interface SessionCardProps {
  device: string;
  browser: string;
  ipAddress: string | null;
  lastActiveAt: string;
  onRevoke: () => void;
  revoking?: boolean;
}

export function SessionCard({
  device,
  browser,
  ipAddress,
  lastActiveAt,
  onRevoke,
  revoking,
}: SessionCardProps): React.JSX.Element {
  return (
    <Card className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Monitor className="h-5 w-5 text-neutral-400" aria-hidden />
        <div>
          <p className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {device} · {browser}
          </p>
          <p className="text-body-sm text-neutral-500 dark:text-neutral-400">
            {ipAddress ?? "Unknown IP"} · Last active {lastActiveAt}
          </p>
        </div>
      </div>
      <Button variant="destructive" size="sm" onClick={onRevoke} loading={revoking}>
        Revoke
      </Button>
    </Card>
  );
}
