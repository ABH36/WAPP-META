"use client";

import { usePathname } from "next/navigation";
import { Permission } from "@wapp/shared-types";
import {
  Bot,
  Building2,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Send,
  FileText,
} from "lucide-react";
import { Sidebar, SidebarGroup, SidebarItem } from "@wapp/ui";
import { useUiStore } from "../../stores/ui-store";
import { useHasPermission } from "../../lib/permissions";

const COMMUNICATION_TABS = [
  { href: "/communication", label: "Dashboard", icon: LayoutDashboard, requires: null },
  {
    href: "/communication/inbox",
    label: "Inbox",
    icon: MessageSquare,
    requires: Permission.REPLY_CONVERSATIONS,
  },
  {
    href: "/communication/broadcasts",
    label: "Broadcasts",
    icon: Send,
    requires: Permission.VIEW_BROADCASTS,
  },
  {
    href: "/communication/campaigns",
    label: "Campaigns",
    icon: Radio,
    requires: Permission.VIEW_BROADCASTS,
  },
  {
    href: "/communication/templates",
    label: "Templates",
    icon: FileText,
    requires: Permission.VIEW_TEMPLATES,
  },
  {
    href: "/communication/automation",
    label: "Automation",
    icon: Bot,
    requires: Permission.VIEW_WORKSPACE,
  },
] as const;

/**
 * FRD-001 Volume-1 §19 / FRD-001 Volume-3 §6 / FRD-001 Volume-4 §6 —
 * remaining module nav items (CRM, Billing, Settings, Team) are added one
 * per module's own frontend implementation step, mirroring `packages/ui`'s
 * own incremental-component-addition convention (`index.ts`'s comment).
 * "Workspace" deep-links straight to `/workspace/profile` — no standalone
 * `/workspace` index page exists (Architecture Review, 2026-08-10).
 * "Communication" expands into up to 6 sub-items — Contacts and Labels are
 * deliberately absent from this list (Architecture Review, 2026-08-11:
 * Contacts is not a standalone module, Labels has no backend support);
 * Broadcasts is present even though the original FRD's §6 nav list didn't
 * name it, since Broadcasts and Campaigns are two distinct backend
 * resources this volume exposes separately. Each sub-item is hidden
 * entirely for roles without the matching read permission — e.g.
 * `MARKETING_EXECUTIVE` has zero Inbox access (`REPLY_CONVERSATIONS` is
 * `NONE`) but full Broadcasts/Campaigns/Templates access, the inverse of
 * `SALES_EXECUTIVE`/`SUPPORT_MANAGER`/`SUPPORT_EXECUTIVE` — same "hide
 * entirely" pattern as Volume-3's Branding/Preferences tabs, since the
 * underlying `GET` routes themselves are permission-gated, not just their
 * writes.
 */
export function WorkspaceSidebar(): React.JSX.Element {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const pathname = usePathname();
  const inCommunication = pathname.startsWith("/communication");

  // Each permission this sidebar might need to check is called unconditionally
  // (never inside the .map() below) — React's rules of hooks require a fixed
  // call order, so every tab's `requires` permission is checked up front here.
  const canReplyConversations = useHasPermission(Permission.REPLY_CONVERSATIONS);
  const canViewBroadcasts = useHasPermission(Permission.VIEW_BROADCASTS);
  const canViewTemplates = useHasPermission(Permission.VIEW_TEMPLATES);
  const canViewWorkspace = useHasPermission(Permission.VIEW_WORKSPACE);

  const grantedPermissions = new Set<Permission>(
    [
      canReplyConversations && Permission.REPLY_CONVERSATIONS,
      canViewBroadcasts && Permission.VIEW_BROADCASTS,
      canViewTemplates && Permission.VIEW_TEMPLATES,
      canViewWorkspace && Permission.VIEW_WORKSPACE,
    ].filter((p): p is Permission => !!p),
  );
  const visibleCommunicationTabs = COMMUNICATION_TABS.filter(
    (tab) => !tab.requires || grantedPermissions.has(tab.requires),
  );

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
      <SidebarGroup
        label="Communication"
        icon={<MessageSquare className="h-4 w-4" aria-hidden />}
        collapsed={collapsed}
        defaultOpen={inCommunication}
      >
        {visibleCommunicationTabs.map((tab) => (
          <SidebarItem
            key={tab.href}
            href={tab.href}
            icon={<tab.icon className="h-4 w-4" aria-hidden />}
            active={pathname === tab.href}
          >
            {tab.label}
          </SidebarItem>
        ))}
      </SidebarGroup>
    </Sidebar>
  );
}
