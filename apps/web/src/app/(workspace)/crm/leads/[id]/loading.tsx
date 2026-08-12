import { SkeletonCard } from "@wapp/ui";

/**
 * FRD-001 Volume-9 §4.1/§4.6 — route-level loading boundary. Every nested
 * route segment gets its own rather than falling back to the shared
 * app-root loading.tsx, so navigating between modules shows a fallback
 * scoped to the content area, not a full-shell flash. Generic 3-card
 * skeleton — deliberately not bespoke per screen (§4.7: "no module-specific
 * redesign"), consistent with how this volume treats every route uniformly.
 */
export default function RouteLoading(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
