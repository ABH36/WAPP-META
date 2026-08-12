import { ReportsView } from "../../../../features/billing/reports-view";

export default function BillingReportsPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Reports</h2>
      <ReportsView />
    </div>
  );
}
