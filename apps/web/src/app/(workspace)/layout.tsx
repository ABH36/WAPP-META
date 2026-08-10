import { WorkspaceHeader } from "../../components/layout/workspace-header";
import { WorkspaceSidebar } from "../../components/layout/workspace-sidebar";

/**
 * Workspace app shell — DS-001 §5 ("persistent left sidebar + topbar + content
 * area"). Route-level auth enforcement itself lives in `middleware.ts`
 * (FRD-001 Volume-1 §8) — this layout only composes the visual shell.
 * Full sidebar navigation (per module) and the real topbar workspace
 * switcher/search/notifications are added with their respective modules —
 * see workspace-header.tsx/workspace-sidebar.tsx's own comments.
 */
export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="flex min-h-screen">
      <WorkspaceSidebar />
      <div className="flex flex-1 flex-col">
        <WorkspaceHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
