"use client";

import { usePathname } from "next/navigation";
import { PlatformPermission } from "@wapp/shared-types";
import {
  Bell,
  FileWarning,
  Flag,
  Gavel,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  ScrollText,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { Sidebar, SidebarItem } from "@wapp/ui";
import { useUiStore } from "../../stores/ui-store";
import { useHasPlatformPermission } from "../../lib/permissions";

const PLATFORM_TABS = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    requires: PlatformPermission.VIEW_PLATFORM_DASHBOARD,
  },
  {
    href: "/workspaces",
    label: "Workspaces",
    icon: Users,
    requires: PlatformPermission.VIEW_WORKSPACES,
  },
  {
    href: "/platform-users",
    label: "Platform Users",
    icon: KeyRound,
    requires: PlatformPermission.MANAGE_PLATFORM_USERS,
  },
  {
    href: "/billing",
    label: "Billing",
    icon: Wallet,
    requires: PlatformPermission.VIEW_PLATFORM_BILLING,
  },
  {
    href: "/support",
    label: "Support",
    icon: LifeBuoy,
    requires: PlatformPermission.MANAGE_SUPPORT,
  },
  {
    href: "/break-glass",
    label: "Break-Glass",
    icon: FileWarning,
    requires: PlatformPermission.VIEW_INVESTIGATION,
  },
  {
    href: "/audit",
    label: "Audit",
    icon: ScrollText,
    requires: PlatformPermission.VIEW_GLOBAL_AUDIT,
  },
  {
    href: "/governance",
    label: "Governance",
    icon: Gavel,
    requires: PlatformPermission.MANAGE_PLATFORM_POLICIES,
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: LineChart,
    requires: PlatformPermission.VIEW_PLATFORM_ANALYTICS,
  },
  {
    href: "/announcements",
    label: "Announcements",
    icon: Bell,
    requires: PlatformPermission.MANAGE_ANNOUNCEMENTS,
  },
  {
    href: "/feature-flags",
    label: "Feature Flags",
    icon: Flag,
    requires: PlatformPermission.MANAGE_PLATFORM_FEATURE_FLAGS,
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    icon: Wrench,
    requires: PlatformPermission.MANAGE_PLATFORM_MAINTENANCE,
  },
] as const;

/**
 * FRD-001 Volume-8 §6 — a flat 12-item list, unlike `apps/web`'s
 * per-module `SidebarGroup` nesting (Communication/CRM/Billing/Settings)
 * — the Platform sidebar's own §6 lists every item at the same level, no
 * grouping concept, matching `apps/admin` being one console rather than
 * several tenant-facing modules. Each item is hidden entirely for roles
 * without the matching read permission (same "hide entirely" discipline
 * every `apps/web` volume established) — e.g. `PLATFORM_SUPPORT_EXECUTIVE`
 * has `VIEW_INVESTIGATION`/`VIEW_GLOBAL_AUDIT`/`VIEW_PLATFORM_BILLING`/
 * `MANAGE_SUPPORT`/`VIEW_PLATFORM_ANALYTICS` but `NONE` on every
 * Super-Admin-only permission (Workspaces status changes aside, Workspace
 * *viewing* stays available to all three roles).
 */
export function PlatformSidebar(): React.JSX.Element {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const pathname = usePathname();

  // Called unconditionally, one per tab, matching apps/web's established
  // "never call a permission hook inside .map()" discipline.
  const canViewDashboard = useHasPlatformPermission(PlatformPermission.VIEW_PLATFORM_DASHBOARD);
  const canViewWorkspaces = useHasPlatformPermission(PlatformPermission.VIEW_WORKSPACES);
  const canManagePlatformUsers = useHasPlatformPermission(PlatformPermission.MANAGE_PLATFORM_USERS);
  const canViewBilling = useHasPlatformPermission(PlatformPermission.VIEW_PLATFORM_BILLING);
  const canManageSupport = useHasPlatformPermission(PlatformPermission.MANAGE_SUPPORT);
  const canViewInvestigation = useHasPlatformPermission(PlatformPermission.VIEW_INVESTIGATION);
  const canViewGlobalAudit = useHasPlatformPermission(PlatformPermission.VIEW_GLOBAL_AUDIT);
  const canManagePolicies = useHasPlatformPermission(PlatformPermission.MANAGE_PLATFORM_POLICIES);
  const canViewAnalytics = useHasPlatformPermission(PlatformPermission.VIEW_PLATFORM_ANALYTICS);
  const canManageAnnouncements = useHasPlatformPermission(PlatformPermission.MANAGE_ANNOUNCEMENTS);
  const canManageFeatureFlags = useHasPlatformPermission(
    PlatformPermission.MANAGE_PLATFORM_FEATURE_FLAGS,
  );
  const canManageMaintenance = useHasPlatformPermission(
    PlatformPermission.MANAGE_PLATFORM_MAINTENANCE,
  );

  const grantedPermissions = new Set<PlatformPermission>(
    [
      canViewDashboard && PlatformPermission.VIEW_PLATFORM_DASHBOARD,
      canViewWorkspaces && PlatformPermission.VIEW_WORKSPACES,
      canManagePlatformUsers && PlatformPermission.MANAGE_PLATFORM_USERS,
      canViewBilling && PlatformPermission.VIEW_PLATFORM_BILLING,
      canManageSupport && PlatformPermission.MANAGE_SUPPORT,
      canViewInvestigation && PlatformPermission.VIEW_INVESTIGATION,
      canViewGlobalAudit && PlatformPermission.VIEW_GLOBAL_AUDIT,
      canManagePolicies && PlatformPermission.MANAGE_PLATFORM_POLICIES,
      canViewAnalytics && PlatformPermission.VIEW_PLATFORM_ANALYTICS,
      canManageAnnouncements && PlatformPermission.MANAGE_ANNOUNCEMENTS,
      canManageFeatureFlags && PlatformPermission.MANAGE_PLATFORM_FEATURE_FLAGS,
      canManageMaintenance && PlatformPermission.MANAGE_PLATFORM_MAINTENANCE,
    ].filter((p): p is PlatformPermission => !!p),
  );
  const visibleTabs = PLATFORM_TABS.filter((tab) => grantedPermissions.has(tab.requires));

  return (
    <Sidebar
      collapsed={collapsed}
      header={<span className="text-h3 text-brand-400 font-semibold">WAPP</span>}
    >
      {visibleTabs.map((tab) => (
        <SidebarItem
          key={tab.href}
          href={tab.href}
          icon={<tab.icon className="h-4 w-4" aria-hidden />}
          collapsed={collapsed}
          active={pathname === tab.href}
        >
          {tab.label}
        </SidebarItem>
      ))}
    </Sidebar>
  );
}
