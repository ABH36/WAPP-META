import { Button } from "@wapp/ui";

/**
 * Placeholder Home page — Phase 1 Foundation only. Verifies the full pipeline
 * (Next.js -> Tailwind -> @wapp/ui) builds and renders end to end. The real
 * Home page (DS-001 §6, PRD-008 Vol 2 §4) is built when the Public Website
 * module begins, per the approved Module Development Order.
 */
export default function HomePage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 py-24 text-center">
      <h1 className="text-h1 text-neutral-900 dark:text-neutral-50">WAPP</h1>
      <p className="text-body max-w-md text-neutral-600 dark:text-neutral-400">
        Project Foundation is live. Marketing content ships with the Public Website module.
      </p>
      <Button variant="primary">Start Free Trial</Button>
    </main>
  );
}
