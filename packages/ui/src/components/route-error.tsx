"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { EmptyState } from "./empty-state";

/**
 * FRD-001 Volume-9 §4.6 — the shared body every route-level `error.tsx`
 * across both apps renders, extracted from `apps/web`'s pre-existing root
 * `error.tsx` (FRD-001 Volume-1 §13/§14, whose own doc-comment already
 * anticipated per-route error boundaries being added later). Never
 * renders the raw error message (TAD-001 ERR-002 — the same rule the
 * backend's `HttpExceptionFilter` enforces); `error.digest` (Next.js's
 * server-side correlation id) is the only detail surfaced, for support
 * correlation. Each app's own `error.tsx`/`global-error.tsx` files stay
 * thin wrappers that just forward `error`/`reset` here — the actual
 * `console.error` reporting call stays in each file since it needs to run
 * exactly once per boundary instance, not be duplicated inside this
 * shared presentational component.
 */
export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function RouteError({ error, reset }: RouteErrorProps): React.JSX.Element {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <EmptyState
        icon={<AlertTriangle className="h-10 w-10" aria-hidden />}
        title="Something went wrong"
        description={
          error.digest
            ? `An unexpected error occurred. Reference: ${error.digest}`
            : "An unexpected error occurred. Please try again."
        }
        action={
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
