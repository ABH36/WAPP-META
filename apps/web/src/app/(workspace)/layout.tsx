import { SkipLink } from "@wapp/ui";
import { WorkspaceHeader } from "../../components/layout/workspace-header";
import { WorkspaceSidebar } from "../../components/layout/workspace-sidebar";

/**
 * Workspace app shell — DS-001 §5 ("persistent left sidebar + topbar + content
 * area"). Route-level auth enforcement itself lives in `middleware.ts`
 * (FRD-001 Volume-1 §8) — this layout only composes the visual shell.
 * Full sidebar navigation (per module) and the real topbar workspace
 * switcher/search/notifications are added with their respective modules —
 * see workspace-header.tsx/workspace-sidebar.tsx's own comments.
 *
 * `SkipLink` (FRD-001 Volume-9 §10) lives here rather than the root
 * layout — only the persistent-sidebar shells (this one, and apps/admin's
 * Platform shell) have nav chrome worth skipping past; (auth)/(public) have
 * none.
 */
export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="flex min-h-screen">
      <SkipLink href="#main-content" />
      <WorkspaceSidebar />
      <div className="flex flex-1 flex-col">
        <WorkspaceHeader />
        <main id="main-content" className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
