import { AnalyticsView } from "../../../features/platform/analytics-view";

export default function AnalyticsPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Analytics</h1>
      <AnalyticsView />
    </div>
  );
}
