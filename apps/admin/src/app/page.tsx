/**
 * Placeholder — Phase 1 Foundation only. Verifies the admin app builds and
 * renders independently from apps/web (SDP-001 §3 — separate deployable).
 * Real screens (Platform Dashboard, Workspace Management, Support Center,
 * Global Audit) are built with the Platform Administration module, last in the
 * approved Module Development Order (SDP-001 §6).
 */
export default function AdminHomePage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col">
      {/* DS-001 §5 — distinguished top bar color so an admin can never confuse
          this console with the workspace app. */}
      <header className="flex h-12 items-center border-b border-neutral-800 bg-neutral-900 px-4">
        <span className="text-body-sm font-medium text-neutral-50">
          WAPP Platform Administration
        </span>
      </header>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-body text-neutral-500">Foundation is live.</p>
      </div>
    </main>
  );
}
