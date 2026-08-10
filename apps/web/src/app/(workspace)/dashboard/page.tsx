/**
 * Placeholder Dashboard page — Phase 1 Foundation / FRD-001 Volume-1 only.
 * Verifies the full authenticated shell (middleware -> AuthProvider ->
 * WorkspaceLayout -> Header/Sidebar) renders end to end. The real Dashboard
 * (widget grid, DS-001 §5) is built with the Workspace module (FRD-001
 * Volume-3), per the approved Module Development Order.
 */
export default function DashboardPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 text-neutral-900 dark:text-neutral-50">Dashboard</h1>
      <p className="text-body mt-2 text-neutral-600 dark:text-neutral-400">
        Frontend Architecture Foundation is live. Dashboard widgets ship with the Workspace module.
      </p>
    </div>
  );
}
