/**
 * Placeholder Platform Dashboard — Phase 1 Foundation / FRD-001 Volume-1
 * only. Verifies the full authenticated shell (middleware -> AuthProvider ->
 * PlatformLayout -> Header/Sidebar) renders end to end. The real Platform
 * Dashboard (PRD-007 §4.2, live cross-tenant aggregation) is built with the
 * Platform Administration UI module (FRD-001 Volume-8), per the approved
 * Module Development Order.
 */
export default function PlatformDashboardPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 text-neutral-900 dark:text-neutral-50">Platform Dashboard</h1>
      <p className="text-body mt-2 text-neutral-600 dark:text-neutral-400">
        Frontend Architecture Foundation is live. Dashboard widgets ship with the Platform
        Administration UI module.
      </p>
    </div>
  );
}
