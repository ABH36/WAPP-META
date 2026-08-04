/**
 * Workspace app shell — DS-001 §5 ("persistent left sidebar + topbar + content
 * area"). Sidebar navigation, workspace switcher, and route-level auth
 * enforcement are added with the Identity/Workspace modules — this establishes
 * the layout boundary only, for Phase 1 Foundation.
 */
export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <div className="flex min-h-screen">{children}</div>;
}
