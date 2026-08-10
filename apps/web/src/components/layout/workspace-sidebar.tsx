"use client";

import { LayoutDashboard } from "lucide-react";
import { Sidebar, SidebarItem } from "@wapp/ui";
import { useUiStore } from "../../stores/ui-store";

/**
 * FRD-001 Volume-1 §19 — module nav items (Inbox, CRM, Billing, Settings,
 * Team) are added one per module's own frontend implementation step,
 * mirroring `packages/ui`'s own incremental-component-addition convention
 * (`index.ts`'s comment). Dashboard is the one link that exists today
 * because it's this app's own root/home destination, not a separate module.
 */
export function WorkspaceSidebar(): React.JSX.Element {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  return (
    <Sidebar
      collapsed={collapsed}
      header={<span className="text-h3 text-brand-600 font-semibold">WAPP</span>}
    >
      <SidebarItem
        href="/dashboard"
        icon={<LayoutDashboard className="h-4 w-4" aria-hidden />}
        collapsed={collapsed}
        active
      >
        Dashboard
      </SidebarItem>
    </Sidebar>
  );
}
