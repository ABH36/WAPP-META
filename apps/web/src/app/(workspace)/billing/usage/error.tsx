"use client";

import * as React from "react";
import { RouteError } from "@wapp/ui";

/**
 * FRD-001 Volume-9 §4.6 — route-level error boundary, scoped to this
 * segment so an error here doesn't take down the whole app shell (sidebar/
 * header stay mounted and usable). See `@wapp/ui`'s `RouteError` for the
 * shared presentational body and `docs/TECH-DEBT.md` TAD-001 ERR-002 for
 * why only `error.digest` is ever shown, never the raw message.
 */
export default function RouteErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    console.error("Unhandled route error", error);
  }, [error]);

  return <RouteError error={error} reset={reset} />;
}
