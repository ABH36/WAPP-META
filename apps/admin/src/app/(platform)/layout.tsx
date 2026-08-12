import { SkipLink } from "@wapp/ui";
import { PlatformHeader } from "../../components/layout/platform-header";
import { PlatformSidebar } from "../../components/layout/platform-sidebar";

/**
 * Platform Administration app shell — DS-001 §5 (separate app shell
 * entirely, distinguished top bar). Route-level auth enforcement lives in
 * middleware.ts. `SkipLink` (FRD-001 Volume-9 §10) skips past the sidebar
 * straight to `#main-content`.
 */
export default function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="flex min-h-screen">
      <SkipLink href="#main-content" />
      <PlatformSidebar />
      <div className="flex flex-1 flex-col">
        <PlatformHeader />
        <main id="main-content" className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
