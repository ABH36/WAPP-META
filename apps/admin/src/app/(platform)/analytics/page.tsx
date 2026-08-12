import dynamic from "next/dynamic";
import { SkeletonCard } from "@wapp/ui";

// FRD-001 Volume-9 §4.1 — code-split; this view pulls in `recharts`.
const AnalyticsView = dynamic(
  () => import("../../../features/platform/analytics-view").then((m) => m.AnalyticsView),
  { loading: () => <SkeletonCard /> },
);

export default function AnalyticsPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Analytics</h1>
      <AnalyticsView />
    </div>
  );
}
