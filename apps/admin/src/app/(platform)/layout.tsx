import { PlatformHeader } from "../../components/layout/platform-header";
import { PlatformSidebar } from "../../components/layout/platform-sidebar";

/** Platform Administration app shell — DS-001 §5 (separate app shell entirely, distinguished top bar). Route-level auth enforcement lives in middleware.ts. */
export default function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="flex min-h-screen">
      <PlatformSidebar />
      <div className="flex flex-1 flex-col">
        <PlatformHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
