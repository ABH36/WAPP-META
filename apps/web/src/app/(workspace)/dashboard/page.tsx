import { WorkspaceIdentityPanel } from "../../../features/workspace/workspace-identity-panel";
import { WorkspaceSummaryCards } from "../../../features/workspace/workspace-summary-cards";

/** FRD-001 Volume-3 §4.1/§4.8 — replaces the Volume-1 placeholder. Identity summary + Quick Actions, then the Subscription/Billing/CRM Summary Cards (Architecture Review, 2026-08-10 — Dashboard IA). */
export default function DashboardPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <WorkspaceIdentityPanel />
      <WorkspaceSummaryCards />
    </div>
  );
}
