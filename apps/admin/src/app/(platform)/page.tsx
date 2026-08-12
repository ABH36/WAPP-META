import { DashboardView } from "../../features/platform/dashboard-view";

/** FRD-001 Volume-8 §4.1 — the real Platform Dashboard, replacing the Volume-1 placeholder that only verified the authenticated shell renders end to end. */
export default function PlatformDashboardPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Platform Dashboard</h1>
      <DashboardView />
    </div>
  );
}
