"use client";

import { WifiOff } from "lucide-react";
import { Button, EmptyState } from "@wapp/ui";

/**
 * FRD-001 Volume-9 §4.3/§4.4 — the service worker's offline navigation
 * fallback (`sw.ts`'s `fallbacks.entries`), served from the precached
 * shell when a navigation fetch fails entirely offline. Read-only, no
 * data fetching of its own (BR-005 "offline mode never performs
 * mutations") — just a retry that re-attempts real navigation once
 * connectivity returns.
 */
export default function OfflinePage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <EmptyState
        icon={<WifiOff className="h-10 w-10" aria-hidden />}
        title="You're offline"
        description="This page isn't available without an internet connection. Check your connection and try again."
        action={
          <Button variant="primary" onClick={() => window.location.reload()}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
