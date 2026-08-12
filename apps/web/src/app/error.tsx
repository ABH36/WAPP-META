"use client";

import * as React from "react";
import { RouteError } from "@wapp/ui";

/**
 * FRD-001 Volume-1 §13/§14 — root Error Boundary. FRD-001 Volume-9
 * extracted the actual presentational body into `@wapp/ui`'s
 * `RouteError`, reused by every nested route's own `error.tsx` too — this
 * file stays the one place `console.error` reporting happens for errors
 * that escape all the way to the root. Unlike every nested `error.tsx`
 * (already inside a parent layout's own `<main>`), this one renders with
 * no enclosing landmark at all — wrapped here, not inside `RouteError`
 * itself, to avoid a duplicate nested `<main>` in the common case.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    // No error-reporting service wired up yet; this is the interim visibility mechanism.
    console.error("Unhandled route error", error);
  }, [error]);

  return (
    <main>
      <RouteError error={error} reset={reset} />
    </main>
  );
}
