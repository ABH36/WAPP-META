"use client";

import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard } from "lucide-react";
import { Sidebar, SidebarItem } from "@wapp/ui";
import { useUiStore } from "../../stores/ui-store";

/**
 * FRD-001 Volume-1 §19 / FRD-001 Volume-3 §6 — remaining module nav items
 * (Inbox, CRM, Billing, Settings, Team) are added one per module's own
 * frontend implementation step, mirroring `packages/ui`'s own
 * incremental-component-addition convention (`index.ts`'s comment).
 * "Workspace" deep-links straight to `/workspace/profile` — no standalone
 * `/workspace` index page exists (Architecture Review, 2026-08-10).
 */
export function WorkspaceSidebar(): React.JSX.Element {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const pathname = usePathname();

  return (
    <Sidebar
      collapsed={collapsed}
      header={<span className="text-h3 text-brand-600 font-semibold">WAPP</span>}
    >
      <SidebarItem
        href="/dashboard"
        icon={<LayoutDashboard className="h-4 w-4" aria-hidden />}
        collapsed={collapsed}
        active={pathname === "/dashboard"}
      >
        Dashboard
      </SidebarItem>
      <SidebarItem
        href="/workspace/profile"
        icon={<Building2 className="h-4 w-4" aria-hidden />}
        collapsed={collapsed}
        active={pathname.startsWith("/workspace")}
      >
        Workspace
      </SidebarItem>
    </Sidebar>
  );
}
