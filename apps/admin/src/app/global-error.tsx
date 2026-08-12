"use client";

import * as React from "react";
import { RouteError } from "@wapp/ui";
import "./globals.css";

/**
 * FRD-001 Volume-9 §4.6 — catches errors thrown by the root layout itself
 * (outside `error.tsx`'s reach, per Next's own docs). Must render its own
 * `<html>`/`<body>` since it fully replaces the root layout when active —
 * `AppProviders` may not have mounted, so this stays independent of any
 * store/query-client state, importing only the stylesheet directly.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    console.error("Unhandled root layout error", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <main>
          <RouteError error={error} reset={reset} />
        </main>
      </body>
    </html>
  );
}
