"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * FRD-001 Volume-4 §6 — a Sidebar nav item that "expands into" child
 * `SidebarItem`s (Communication's own §6 language). Extends the DS-001 §4/§5
 * Sidebar system (Volume-1) with a nested-group pattern it didn't need
 * until this volume — a legitimate incremental addition, same reasoning as
 * every prior volume's new-component additions. When `collapsed` (the
 * Sidebar's own icon-only rail mode), children are never rendered — there's
 * no room for a flyout submenu in this design, matching how `SidebarItem`
 * already drops its label text in that mode.
 */
export interface SidebarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  label: string;
  collapsed?: boolean;
  defaultOpen?: boolean;
}

export const SidebarGroup = React.forwardRef<HTMLDivElement, SidebarGroupProps>(
  ({ className, icon, label, collapsed, defaultOpen = false, children, ...props }, ref) => {
    const [open, setOpen] = React.useState(defaultOpen);

    React.useEffect(() => {
      if (defaultOpen) setOpen(true);
    }, [defaultOpen]);

    if (collapsed) {
      return (
        <div ref={ref} className={cn("px-3 py-2", className)} {...props}>
          {icon}
        </div>
      );
    }

    return (
      <div ref={ref} className={className} {...props}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="text-body duration-micro flex w-full items-center gap-3 rounded-md px-3 py-2 font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {icon}
          <span className="flex-1 truncate text-left">{label}</span>
          <ChevronDown
            className={cn("duration-micro h-4 w-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
        {open ? <div className="flex flex-col gap-0.5 pl-6">{children}</div> : null}
      </div>
    );
  },
);
SidebarGroup.displayName = "SidebarGroup";
