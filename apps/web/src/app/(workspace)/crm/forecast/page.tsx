import dynamic from "next/dynamic";
import { SkeletonCard } from "@wapp/ui";

// FRD-001 Volume-9 §4.1 — code-split; this view pulls in `recharts`.
const ForecastView = dynamic(
  () => import("../../../../features/crm/forecast-view").then((m) => m.ForecastView),
  { loading: () => <SkeletonCard /> },
);

export default function ForecastPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Forecast</h2>
      <ForecastView />
    </div>
  );
}
