"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button, EmptyState } from "@wapp/ui";

/** FRD-001 Volume-1 §13/§14 — root Error Boundary. Never renders the raw error message (TAD-001 ERR-002 — same rule the backend's HttpExceptionFilter already enforces); `error.digest` (Next.js's server-side correlation id) is the only thing surfaced, for support correlation. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    // Volume-1 has no error-reporting service wired up yet; this is the interim visibility mechanism.
    console.error("Unhandled route error", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center">
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
