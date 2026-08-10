"use client";

import { LayoutDashboard } from "lucide-react";
import { Sidebar, SidebarItem } from "@wapp/ui";
import { useUiStore } from "../../stores/ui-store";

/** Module nav items (Workspaces, Billing Ops, Support, Audit, Analytics/Governance) are added one per module's own frontend implementation step, mirroring apps/web's own sidebar convention. */
export function PlatformSidebar(): React.JSX.Element {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  return (
    <Sidebar
      collapsed={collapsed}
      header={<span className="text-h3 text-brand-400 font-semibold">WAPP</span>}
    >
      <SidebarItem
        href="/"
        icon={<LayoutDashboard className="h-4 w-4" aria-hidden />}
        collapsed={collapsed}
        active
      >
        Dashboard
      </SidebarItem>
    </Sidebar>
  );
}
