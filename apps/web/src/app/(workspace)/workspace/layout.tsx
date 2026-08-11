"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Permission } from "@wapp/shared-types";
import { useHasPermission } from "../../../lib/permissions";

const TABS = [
  { href: "/workspace/profile", label: "Business Profile", requiresEdit: false },
  { href: "/workspace/business-hours", label: "Business Hours", requiresEdit: false },
  { href: "/workspace/branding", label: "Branding", requiresEdit: true },
  { href: "/workspace/preferences", label: "Preferences", requiresEdit: true },
  { href: "/workspace/notifications", label: "Notifications", requiresEdit: false },
];

/**
 * FRD-001 Volume-3 §5 — the 5 Workspace management sub-routes share one
 * sub-nav shell, mirroring `(workspace)/profile/layout.tsx`'s established
 * pattern. No standalone `/workspace` index page (Architecture Review,
 * 2026-08-10) — the sidebar's "Workspace" item deep-links straight to
 * `/workspace/profile`. Branding and Preferences are hidden entirely for
 * roles without `EDIT_WORKSPACE` — unlike the other three tabs (read via
 * `GET /workspaces/me`, gated `VIEW_WORKSPACE`, readable by every role),
 * their data source (`GET /settings`) is itself gated `EDIT_WORKSPACE`
 * and would 403 on load, not just on submit. Same "hide entirely" pattern
 * already approved for the Billing Summary Card.
 */
export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const pathname = usePathname();
  const canEditWorkspace = useHasPermission(Permission.EDIT_WORKSPACE);
  const visibleTabs = TABS.filter((tab) => !tab.requiresEdit || canEditWorkspace);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Workspace</h1>
      <nav className="mb-6 flex flex-wrap gap-4 border-b border-neutral-200 dark:border-neutral-800">
        {visibleTabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                active
                  ? "text-body-sm border-brand-600 text-brand-700 dark:text-brand-300 border-b-2 pb-2 font-medium"
                  : "text-body-sm pb-2 font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
