import { DashboardView } from "../../../features/crm/dashboard-view";

export default function CrmDashboardPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">CRM Dashboard</h2>
      <DashboardView />
    </div>
  );
}
