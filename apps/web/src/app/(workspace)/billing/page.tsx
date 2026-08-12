import { DashboardView } from "../../../features/billing/dashboard-view";

export default function BillingDashboardPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Billing Dashboard</h2>
      <DashboardView />
    </div>
  );
}
