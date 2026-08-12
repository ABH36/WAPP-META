import * as React from "react";
import { Card } from "./card";
import { Badge } from "./badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-7 §4.8/§7 — one API Key row. Never renders the raw secret — `prefix` (a short, safe-to-display fragment) is the only key-material field this component ever sees, matching `ApiKeySummary`'s own shape (BR-004). */
export interface ApiKeyCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  name: string;
  prefix: string;
  scope: string;
  status: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  onRevoke?: () => void;
  onRotate?: () => void;
}

export const ApiKeyCard = React.forwardRef<HTMLDivElement, ApiKeyCardProps>(
  (
    { className, name, prefix, scope, status, lastUsedAt, expiresAt, onRevoke, onRotate, ...props },
    ref,
  ) => {
    const revoked = status !== "ACTIVE";
    return (
      <Card ref={ref} className={cn("flex flex-col gap-2", className)} {...props}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {name}
          </span>
          <Badge variant={revoked ? "danger" : "success"}>{status}</Badge>
        </div>
        <code className="text-caption text-neutral-500 dark:text-neutral-400">{prefix}…</code>
        <div className="text-caption flex flex-wrap items-center gap-x-4 gap-y-1 text-neutral-500 dark:text-neutral-400">
          <span>Scope: {scope}</span>
          <span>
            {lastUsedAt ? `Last used ${new Date(lastUsedAt).toLocaleDateString()}` : "Never used"}
          </span>
          <span>
            {expiresAt ? `Expires ${new Date(expiresAt).toLocaleDateString()}` : "No expiry"}
          </span>
        </div>
        {!revoked && (onRevoke ?? onRotate) ? (
          <div className="flex gap-2">
            {onRotate ? (
              <button
                type="button"
                onClick={onRotate}
                className="text-caption text-brand-600 hover:underline"
              >
                Rotate
              </button>
            ) : null}
            {onRevoke ? (
              <button
                type="button"
                onClick={onRevoke}
                className="text-caption text-danger-600 dark:text-danger-400 hover:underline"
              >
                Revoke
              </button>
            ) : null}
          </div>
        ) : null}
      </Card>
    );
  },
);
ApiKeyCard.displayName = "ApiKeyCard";
