import * as React from "react";
import { cn } from "../lib/cn";

/**
 * DS-001 §4/§5 — Sidebar, "custom" base, variants `collapsed`/`expanded`.
 * A pure layout shell: header slot (logo/switcher/tenant-search), scrollable
 * nav slot, footer slot (user menu). Each app supplies its own nav items —
 * this component never hardcodes module links, only the structural regions
 * and the collapse/expand mechanics.
 */
export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  collapsed?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  ({ className, collapsed = false, header, footer, children, ...props }, ref) => {
    return (
      <aside
        ref={ref}
        className={cn(
          "bg-neutral-0 duration-component flex h-screen flex-col border-r border-neutral-200 transition-[width] dark:border-neutral-800 dark:bg-neutral-950",
          collapsed ? "w-16" : "w-64",
          className,
        )}
        {...props}
      >
        {header ? (
          <div className="flex h-14 items-center border-b border-neutral-200 px-3 dark:border-neutral-800">
            {header}
          </div>
        ) : null}
        <nav className="flex-1 overflow-y-auto p-2">{children}</nav>
        {footer ? (
          <div className="border-t border-neutral-200 p-2 dark:border-neutral-800">{footer}</div>
        ) : null}
      </aside>
    );
  },
);
Sidebar.displayName = "Sidebar";

export interface SidebarItemProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  icon?: React.ReactNode;
  active?: boolean;
  collapsed?: boolean;
}

export const SidebarItem = React.forwardRef<HTMLAnchorElement, SidebarItemProps>(
  ({ className, icon, active, collapsed, children, ...props }, ref) => {
    return (
      <a
        ref={ref}
        className={cn(
          "text-body duration-micro flex items-center gap-3 rounded-md px-3 py-2 font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
          active && "bg-brand-50 text-brand-700 dark:bg-brand-900 dark:text-brand-300",
          className,
        )}
        {...props}
      >
        {icon}
        {collapsed ? null : <span className="truncate">{children}</span>}
      </a>
    );
  },
);
SidebarItem.displayName = "SidebarItem";
