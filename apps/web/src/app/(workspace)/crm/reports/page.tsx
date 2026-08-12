import dynamic from "next/dynamic";
import { SkeletonCard } from "@wapp/ui";

// FRD-001 Volume-9 §4.1 — code-split; this view pulls in `recharts`.
const ReportsView = dynamic(
  () => import("../../../../features/crm/reports-view").then((m) => m.ReportsView),
  { loading: () => <SkeletonCard /> },
);

export default function ReportsPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Reports</h2>
      <ReportsView />
    </div>
  );
}
